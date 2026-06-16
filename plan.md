1. **Explore & Identify Problem Areas:** I have identified `typeBadge` and `statusBadge` styles that are not consistent with the semantic rules in `DESIGN.md` across multiple screens. Some are hard-coded inline, and some don't use the standard `SrmStatusBadge` component. For example, `app/(tabs)/home.tsx` has hardcoded type badges `<View style={{ backgroundColor: '#F3F4F6', ... }}><Text>{item.type}</Text></View>`. The status badges on `app/(tabs)/home.tsx` also have hardcoded padding, border radius, background color and text colors inline. The `app/(admin)/dashboard.tsx` has a custom `typeBadge` in the stylesheet that does not use `SrmStatusBadge`. The same goes for `app/(admin)/incidents.tsx` and `app/(director)/incidents.tsx`.

2. **Refactor Type Badges:**
   - We will replace the custom type badges with `SrmStatusBadge` with `variant="neutral"` for `type`.
   - In `app/(admin)/dashboard.tsx` replace the `typeBadge` and `typeBadgeText` styled Views/Texts with `<SrmStatusBadge label={item.type} />`.
   - In `app/(admin)/incidents.tsx` replace `typeBadge` similarly.
   - In `app/(director)/incidents.tsx` replace the raw `<Text style={styles.typeBadge}>` with `<SrmStatusBadge label={incident.type} />`.
   - In `app/(tabs)/home.tsx` line 301, replace the inline-styled `View` containing `Text` with `<SrmStatusBadge label={item.type} />`.

3. **Refactor Status Badges:**
   - In `app/(admin)/dashboard.tsx` (line 376) and `app/(admin)/incidents.tsx` (line 352), replace `statusBadge` implementation with `SrmStatusBadge` using appropriate variants (`success`, `danger`, `warning` depending on the status: `open` -> `danger`, `closed` -> `success`).
   - In `app/(director)/incidents.tsx` (line 192), replace `<Text style={styles.statusBadge...}>` with `<SrmStatusBadge variant={isOpen ? 'danger' : 'success'} label={isOpen ? 'OUVERT' : 'CLÔTURÉ'} />`.
   - In `app/(tabs)/home.tsx` line 328+, replace the manual status label `View` and `Text` with `<SrmStatusBadge variant={isOpen ? 'danger' : 'success'} label={isOpen ? 'OUVERT' : 'CLÔTURÉ'} />`.
   - In `app/(tabs)/home.tsx` line 500+, replace the manual status label `View` and `Text` with `<SrmStatusBadge variant={selectedIncident.status !== 'closed' ? 'warning' : 'success'} label={selectedIncident.status !== 'closed' ? 'EN COURS' : 'CLÔTURÉ'} />`.

4. **Run Verification:**
   - Run `pnpm install`, `pnpm lint`, `pnpm test`, and `pnpm exec tsc --noEmit`.

5. **Complete Pre-commit Steps:**
   - Run `pre_commit_instructions` to "ensure proper testing, verification, review, and reflection are done".

6. **Create Pull Request:**
   - Create PR with title "🎨 Palette: Standardize type and status badges" and a description detailing What, Why, Before/After, and Polish.
