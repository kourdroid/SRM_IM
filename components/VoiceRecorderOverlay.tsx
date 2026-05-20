import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect } from "react";
import { Dimensions, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
    Easing,
    Extrapolation,
    interpolate,
    SharedValue,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withSpring,
    withTiming
} from "react-native-reanimated";
import { Circle } from "react-native-svg";

const { width } = Dimensions.get("window");
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface Props {
    isVisible: boolean;
    isRecording: boolean;
    isProcessing: boolean;
    metering: SharedValue<number>; // dB value: -160 to 0
    onStartRecording: () => void;
    onStopRecording: () => void;
    onCancel: () => void;
    durationFormatted: string;
}

export default function VoiceRecorderOverlay({
    isVisible,
    isRecording,
    isProcessing,
    metering,
    onStartRecording,
    onStopRecording,
    onCancel,
    durationFormatted
}: Props) {
    // 1. Enter Animation
    const containerOpacity = useSharedValue(0);

    useEffect(() => {
        containerOpacity.value = withTiming(isVisible ? 1 : 0, { duration: 400 });
    }, [isVisible]);

    const containerStyle = useAnimatedStyle(() => ({
        opacity: containerOpacity.value,
        transform: [{ scale: interpolate(containerOpacity.value, [0, 1], [1.1, 1]) }]
    }));

    if (!isVisible && containerOpacity.value === 0) return null;

    // 2. Visualizer Bars (Creating 5 bars for simple generic "AI" look)
    // We can also do a circle pulse.
    // User requested "disibles of sound".

    // Pulse Animation based on metering
    const orbStyle = useAnimatedStyle(() => {
        // Metering is approx -60 (quiet) to 0 (loud). -160 is silence.
        // Map -60 -> 0 to Scale 1 -> 1.5
        const db = metering.value;
        const scale = interpolate(db, [-60, 0], [1, 1.8], Extrapolation.CLAMP);
        const opacity = interpolate(db, [-60, 0], [0.5, 1], Extrapolation.CLAMP);

        return {
            transform: [{ scale: withSpring(isRecording ? scale : 1, { damping: 10 }) }],
            opacity: withSpring(isRecording ? opacity : 0.6)
        };
    });

    // Processing Animation (Spin)
    const spin = useSharedValue(0);
    useEffect(() => {
        if (isProcessing) {
            spin.value = withRepeat(withTiming(360, { duration: 2000, easing: Easing.linear }), -1);
        } else {
            spin.value = 0;
        }
    }, [isProcessing]);

    const loadingStyle = useAnimatedStyle(() => ({
        transform: [{ rotate: `${spin.value}deg` }]
    }));

    return (
        <Animated.View style={[styles.overlay, containerStyle]}>
            <LinearGradient
                colors={['#0F172A', '#020617', '#000000']}
                style={StyleSheet.absoluteFill}
            />

            {/* Background Particles/Glow */}
            <View style={styles.glowContainer}>
                <View style={styles.glowBlob} />
            </View>

            <View style={styles.content}>

                {/* Header Text */}
                <Text style={styles.title}>
                    {isProcessing ? "Processing Intelligence..." : isRecording ? "Listening..." : "New Incident"}
                </Text>

                {!isProcessing && (
                    <Text style={styles.subtitle}>
                        {isRecording ? durationFormatted : "Tap to activate AI Voice Analysis"}
                    </Text>
                )}

                {/* Dynamic Orb / Button */}
                <View style={styles.orbContainer}>
                    {/* The Glowing Aura */}
                    <Animated.View style={[styles.orbGlow, orbStyle]} />

                    {/* Loading Ring */}
                    {isProcessing && (
                        <Animated.View style={[styles.loadingRing, loadingStyle]}>
                            <LinearGradient
                                colors={['transparent', '#DAF22C']}
                                style={{ flex: 1, borderRadius: 100 }}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                            />
                        </Animated.View>
                    )}

                    {/* Main Button */}
                    <Pressable
                        onPress={isRecording ? onStopRecording : onStartRecording}
                        disabled={isProcessing}
                        style={[styles.mainButton, isRecording && styles.recordingButton]}
                    >
                        <Ionicons
                            name={isRecording ? "stop" : "mic"}
                            size={40}
                            color={isRecording ? "#FFFFFF" : "#191820"}
                        />
                    </Pressable>
                </View>

                {/* Waveform Visualization (Simple CSS Bars if simple, or SVG for complexity) */}
                {/* For performance, we stick to the Orb Pulse above which is driven by metering */}

                {/* Cancel Action */}
                <Pressable onPress={onCancel} style={styles.cancelButton}>
                    <View style={styles.cancelIcon}>
                        <Ionicons name="close" size={24} color="#FFFFFF" />
                    </View>
                    <Text style={styles.cancelText}>Cancel</Text>
                </Pressable>

            </View>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    overlay: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 50,
        justifyContent: 'center',
        alignItems: 'center',
    },
    glowContainer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        overflow: 'hidden',
    },
    glowBlob: {
        width: width,
        height: width,
        borderRadius: width / 2,
        backgroundColor: 'rgba(218, 242, 44, 0.15)',
        position: 'absolute',
        top: '20%',
        left: 0,
        filter: 'blur(60px)', // Works on Web, on Native needs image or SVG blur. 
        // For Native simple implementation:
        shadowColor: '#DAF22C',
        shadowOpacity: 0.5,
        shadowRadius: 100,
        elevation: 20
    },
    content: {
        alignItems: 'center',
        width: '100%',
        padding: 32,
    },
    title: {
        color: '#FFFFFF',
        fontSize: 24,
        fontWeight: '700',
        marginBottom: 8,
        letterSpacing: 0.5,
    },
    subtitle: {
        color: '#94A3B8',
        fontSize: 16,
        marginBottom: 60,
        fontFamily: 'System', // Monospace font if available would look cool
    },
    orbContainer: {
        width: 200,
        height: 200,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 80,
    },
    orbGlow: {
        position: 'absolute',
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: 'rgba(218, 242, 44, 0.4)',
        shadowColor: '#DAF22C',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 40,
        elevation: 30, // Strong Android Glow
    },
    mainButton: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: '#DAF22C',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10,
        shadowColor: '#DAF22C',
        shadowOpacity: 0.5,
        shadowRadius: 20,
        elevation: 10,
    },
    recordingButton: {
        backgroundColor: '#EF4444', // Red for stop
        shadowColor: '#EF4444',
    },
    loadingRing: {
        position: 'absolute',
        width: 140,
        height: 140,
        borderRadius: 70,
        borderWidth: 4,
        borderColor: 'transparent',
        borderTopColor: '#DAF22C',
        borderRightColor: 'rgba(218, 242, 44, 0.5)',
        zIndex: 5,
    },
    cancelButton: {
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
        opacity: 0.8,
    },
    cancelIcon: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: 'rgba(255,255,255,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    cancelText: {
        color: '#FFFFFF',
        fontSize: 14,
    }
});
