const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const React = require('react');
const ts = require('typescript');

function load(relative, requireMock) {
  const filename = path.resolve(__dirname, '..', relative);
  const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const module = { exports: {} };
  vm.runInThisContext(`(function(require,module,exports){${source}\n})`, { filename })(requireMock, module, module.exports);
  return module.exports;
}

const authError = (code, message = 'raw english text') => Object.assign(new Error(message), { code });
const flush = () => new Promise(resolve => setTimeout(resolve, 10));

function loadPasswordService() {
  const calls = { verify: 0, isolatedUpdate: 0, isolatedSignOut: 0, signIn: 0, mainUpdate: 0 };
  const results = { verify: [], isolatedUpdate: [], signIn: [], mainUpdate: [] };
  const next = queue => ({ error: queue.shift() ?? null });
  const service = load('src/core/services/passwordService.ts', name => {
    if (name === '@/lib/supabase') {
      return {
        hasRemoteNetwork: async () => true,
        supabaseUrl: 'https://example.test',
        supabaseAnonKey: 'key',
        supabaseFetch: fetch,
        toSupabaseUserMessage: error => error.message,
        supabase: { auth: {
          resetPasswordForEmail: async () => ({ error: null }),
          updateUser: async () => { calls.mainUpdate += 1; return next(results.mainUpdate); },
        } },
      };
    }
    if (name === '@supabase/supabase-js') {
      return { createClient: () => ({ auth: {
        verifyOtp: async () => { calls.verify += 1; return next(results.verify); },
        updateUser: async () => { calls.isolatedUpdate += 1; return next(results.isolatedUpdate); },
        signInWithPassword: async () => { calls.signIn += 1; return next(results.signIn); },
        signOut: async () => { calls.isolatedSignOut += 1; return { error: null }; },
      } }) };
    }
    return require(name);
  });
  return { service, calls, results };
}

async function passwordChecks() {
  const originalWarn = console.warn;
  console.warn = () => {};
  try {
    {
      const { service, calls, results } = loadPasswordService();
      const reset = service.createPasswordReset();
      results.isolatedUpdate.push(authError('same_password'));
      await assert.rejects(reset.submit('A@b.ma ', '123456', 'first1'), /différent/);
      await reset.submit('a@b.ma', '123456', 'second2');
      assert.equal(calls.verify, 1, 'a rejected password must not spend the code twice');
      assert.equal(calls.isolatedUpdate, 2);
      assert.equal(calls.isolatedSignOut, 1);
      assert.equal(calls.mainUpdate, 0, 'a reset must not touch the device session');
    }
    {
      const { service, calls, results } = loadPasswordService();
      const reset = service.createPasswordReset();
      results.verify.push(authError('otp_expired'));
      await assert.rejects(reset.submit('a@b.ma', '000000', 'first1'), /Code incorrect/);
      assert.equal(calls.isolatedUpdate, 0);
      await reset.submit('a@b.ma', '123456', 'first1');
      assert.equal(calls.verify, 2, 'a new code is verified again');
    }
    {
      const { service, calls, results } = loadPasswordService();
      results.signIn.push(authError('invalid_credentials'));
      await assert.rejects(service.PasswordService.changePassword('a@b.ma', 'wrong1', 'next12'), /actuel est incorrect/);
      assert.equal(calls.mainUpdate, 0);
      await assert.rejects(service.PasswordService.changePassword('a@b.ma', 'same12', 'same12'), /différent/);
      await service.PasswordService.changePassword('a@b.ma', 'old123', 'next12');
      assert.equal(calls.mainUpdate, 1, 'the device session must perform the update');
      assert.equal(calls.isolatedUpdate, 0);
    }
    {
      const { service, results } = loadPasswordService();
      results.mainUpdate.push(authError('reauthentication_needed'));
      await assert.rejects(service.PasswordService.changePassword('a@b.ma', 'old123', 'next12'), /reconnectez-vous/);
      results.mainUpdate.push(authError('some_new_code'));
      await assert.rejects(service.PasswordService.changePassword('a@b.ma', 'old123', 'next12'), /L’opération a échoué/);
    }
    const { service } = loadPasswordService();
    assert.match(service.validateNewPassword('short', 'short'), /au moins 6/);
    assert.match(service.validateNewPassword('longer1', 'longer2'), /correspondent/);
    assert.equal(service.validateNewPassword('longer1', 'longer1'), null);
  } finally {
    console.warn = originalWarn;
  }
}

async function authContextChecks() {
  const profile = { role: 'admin', approval_status: 'approved' };
  let profileFetches = 0;
  let listener;
  const session = id => ({ user: { id } });
  const slots = [];
  let cursor = 0;
  const effects = [];
  let firstRender = true;
  const hooks = {
    ...React,
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = initial;
      return [slots[index], value => { slots[index] = typeof value === 'function' ? value(slots[index]) : value; }];
    },
    useRef(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = { current: initial };
      return slots[index];
    },
    useCallback: fn => fn,
    useEffect(fn) { if (firstRender) effects.push(fn); },
  };
  const supabase = {
    auth: {
      getSession: async () => ({ data: { session: session('user-1') } }),
      onAuthStateChange(callback) {
        listener = callback;
        return { data: { subscription: { unsubscribe() {} } } };
      },
    },
    from: () => ({ select: () => ({ eq: () => ({ single: async () => {
      profileFetches += 1;
      return { data: { ...profile }, error: null };
    } }) }) }),
  };
  const { AuthProvider } = load('contexts/AuthContext.tsx', name => {
    if (name === 'react') return hooks;
    if (name === '../lib/authStorage') return { authStorage: {
      getItemAsync: async () => null, setItemAsync: async () => {}, deleteItemAsync: async () => {},
    } };
    if (name === '../lib/asyncTimeout') return { withTimeout: promise => promise, isOperationTimeoutError: () => false };
    if (name === '../lib/supabase') return {
      supabase,
      hasRemoteNetwork: async () => true,
      handleInvalidSupabaseSession: async () => false,
      isSupabaseNetworkError: () => false,
    };
    return require(name);
  });
  const read = () => {
    cursor = 0;
    return AuthProvider({ children: null }).props.value;
  };

  read();
  firstRender = false;
  effects.forEach(effect => effect());
  await flush();
  assert.equal(read().isAdmin, true);
  assert.equal(read().loading, false);

  for (const event of ['TOKEN_REFRESHED', 'USER_UPDATED']) {
    const before = profileFetches;
    listener(event, session('user-1'));
    assert.equal(read().role, 'admin', `${event} must keep the role`);
    assert.equal(read().loading, false, `${event} must not show the loading screen`);
    await flush();
    assert.equal(profileFetches, before + 1, `${event} must re-check the profile`);
    assert.equal(read().isAdmin, true);
    assert.equal(read().loading, false);
  }

  profile.approval_status = 'rejected';
  listener('TOKEN_REFRESHED', session('user-1'));
  await flush();
  assert.equal(read().isApproved, false, 'a rejected user loses access at the next refresh');
  profile.approval_status = 'approved';

  listener('SIGNED_IN', session('user-2'));
  assert.equal(read().role, null, 'another user starts without the previous role');
  assert.equal(read().loading, true);
  await flush();
  assert.equal(read().loading, false);

  listener('TOKEN_REFRESHED', null);
  listener('SIGNED_OUT', null);
  assert.equal(read().session, null);
  assert.equal(read().loading, false);
}

(async () => {
  await passwordChecks();
  await authContextChecks();
  console.log('Password flow checks passed: reset retry keeps the code, change uses the device session, role is re-checked on refresh.');
})().catch(error => {
  console.error(error);
  process.exit(1);
});
