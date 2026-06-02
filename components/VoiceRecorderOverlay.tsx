import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from "@/src/core/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
    Extrapolation,
    interpolate,
    SharedValue,
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from "react-native-reanimated";

interface Props {
    isVisible: boolean;
    isRecording: boolean;
    isProcessing: boolean;
    metering: SharedValue<number>;
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
    const containerOpacity = useSharedValue(0);

    useEffect(() => {
        containerOpacity.value = withTiming(isVisible ? 1 : 0, { duration: 180 });
    }, [containerOpacity, isVisible]);

    const containerStyle = useAnimatedStyle(() => ({
        opacity: containerOpacity.value,
    }));

    const meterStyle = useAnimatedStyle(() => {
        const scale = interpolate(metering.value, [-60, 0], [0.16, 1], Extrapolation.CLAMP);
        return {
            transform: [{ scaleX: isRecording ? scale : 0.16 }],
        };
    });

    if (!isVisible && containerOpacity.value === 0) return null;

    const title = isProcessing
        ? "Analyse du signalement"
        : isRecording
            ? "Écoute en cours"
            : "Signalement vocal";

    const status = isProcessing
        ? "Traitement de l'audio..."
        : isRecording
            ? durationFormatted
            : "Dictez l'incident en Darija ou en français.";

    return (
        <Animated.View style={[styles.overlay, containerStyle]}>
            <View style={styles.header}>
                <View>
                    <Text style={styles.headerKicker}>NOUVEL INCIDENT</Text>
                    <Text style={styles.headerTitle}>{title}</Text>
                </View>
                <Pressable onPress={onCancel} style={styles.closeButton} disabled={isProcessing}>
                    <Ionicons name="close" size={22} color={COLORS.surface} />
                </Pressable>
            </View>

            <View style={styles.content}>
                <View style={styles.panel}>
                    <View style={styles.meterTrack}>
                        <Animated.View style={[styles.meterFill, meterStyle]} />
                    </View>

                    <Text style={styles.statusText}>{status}</Text>
                    <Text style={styles.helperText}>
                        Vous pourrez vérifier et corriger les champs avant l&apos;enregistrement.
                    </Text>

                    <Pressable
                        onPress={isRecording ? onStopRecording : onStartRecording}
                        disabled={isProcessing}
                        style={[
                            styles.recordButton,
                            isRecording && styles.recordButtonActive,
                            isProcessing && styles.recordButtonDisabled,
                        ]}
                    >
                        {isProcessing ? (
                            <Ionicons name="hourglass-outline" size={34} color={COLORS.textPrimary} />
                        ) : (
                            <Ionicons
                                name={isRecording ? "stop" : "mic"}
                                size={36}
                                color={isRecording ? COLORS.surface : COLORS.textPrimary}
                            />
                        )}
                    </Pressable>

                    <Text style={styles.actionLabel}>
                        {isProcessing ? "Analyse" : isRecording ? "Arrêter" : "Démarrer"}
                    </Text>
                </View>

                <Pressable onPress={onCancel} style={styles.manualButton} disabled={isProcessing}>
                    <Ionicons name="create-outline" size={20} color={COLORS.textPrimary} />
                    <Text style={styles.manualButtonText}>Saisie manuelle</Text>
                </Pressable>
            </View>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    overlay: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 50,
        backgroundColor: COLORS.background,
    },
    header: {
        backgroundColor: COLORS.textPrimary,
        paddingHorizontal: SPACING.xl,
        paddingTop: SPACING.section,
        paddingBottom: SPACING.xxl,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    headerKicker: {
        ...TYPOGRAPHY.labelUppercase,
        color: COLORS.accent,
        marginBottom: SPACING.xs,
    },
    headerTitle: {
        ...TYPOGRAPHY.display,
        color: COLORS.surface,
    },
    closeButton: {
        width: 40,
        height: 40,
        borderRadius: RADIUS.md,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.18)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    content: {
        flex: 1,
        padding: SPACING.xl,
        justifyContent: 'center',
    },
    panel: {
        backgroundColor: COLORS.surface,
        borderRadius: RADIUS.lg,
        borderWidth: 1,
        borderColor: COLORS.border,
        padding: SPACING.xxl,
        alignItems: 'center',
    },
    meterTrack: {
        width: '100%',
        height: 8,
        borderRadius: RADIUS.sm,
        backgroundColor: COLORS.background,
        overflow: 'hidden',
        marginBottom: SPACING.xxl,
    },
    meterFill: {
        width: '100%',
        height: '100%',
        backgroundColor: COLORS.accent,
    },
    statusText: {
        ...TYPOGRAPHY.heading,
        color: COLORS.textPrimary,
        textAlign: 'center',
    },
    helperText: {
        ...TYPOGRAPHY.body,
        color: COLORS.textSecondary,
        textAlign: 'center',
        marginTop: SPACING.sm,
        marginBottom: SPACING.xxl,
    },
    recordButton: {
        width: 104,
        height: 104,
        borderRadius: RADIUS.lg,
        backgroundColor: COLORS.accent,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: COLORS.accent,
    },
    recordButtonActive: {
        backgroundColor: COLORS.signalRed,
        borderColor: COLORS.signalRed,
    },
    recordButtonDisabled: {
        opacity: 0.7,
    },
    actionLabel: {
        ...TYPOGRAPHY.labelUppercase,
        color: COLORS.textSecondary,
        marginTop: SPACING.md,
    },
    manualButton: {
        height: 52,
        borderRadius: RADIUS.md,
        borderWidth: 1,
        borderColor: COLORS.border,
        backgroundColor: COLORS.surface,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: SPACING.sm,
        marginTop: SPACING.lg,
    },
    manualButtonText: {
        ...TYPOGRAPHY.bodyBold,
        color: COLORS.textPrimary,
    },
});
