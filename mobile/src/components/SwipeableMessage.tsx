import React, { useRef } from "react";
import {
  Animated,
  PanResponder,
  View,
  StyleSheet,
  Pressable,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { haptics } from "../utils/haptics";

interface SwipeableMessageProps {
  children: React.ReactNode;
  onReply: () => void;
  onLongPress?: () => void;
  disabled?: boolean;
}

export default function SwipeableMessage({
  children,
  onReply,
  onLongPress,
  disabled,
}: SwipeableMessageProps) {
  const panX = useRef(new Animated.Value(0)).current;
  const triggered = useRef(false);
  const lastTap = useRef(0);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        if (disabled) return false;
        return gestureState.dx > 12 && Math.abs(gestureState.dy) < 18;
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dx > 0) {
          const dx = Math.min(gestureState.dx * 0.6, 75);
          panX.setValue(dx);
          if (dx >= 42 && !triggered.current) {
            triggered.current = true;
            haptics.tap();
          } else if (dx < 42) {
            triggered.current = false;
          }
        }
      },
      onPanResponderRelease: () => {
        if (triggered.current) {
          onReply();
        }
        triggered.current = false;
        Animated.spring(panX, {
          toValue: 0,
          useNativeDriver: true,
          tension: 40,
          friction: 7,
        }).start();
      },
      onPanResponderTerminate: () => {
        triggered.current = false;
        Animated.spring(panX, {
          toValue: 0,
          useNativeDriver: true,
        }).start();
      },
    }),
  ).current;

  const handlePress = () => {
    const now = Date.now();
    if (now - lastTap.current < 320) {
      haptics.tap();
      onReply();
      lastTap.current = 0;
    } else {
      lastTap.current = now;
    }
  };

  return (
    <View style={styles.container}>
      {/* Background Reply Arrow Icon */}
      <Animated.View
        style={[
          styles.replyIconContainer,
          {
            opacity: panX.interpolate({
              inputRange: [0, 15, 42],
              outputRange: [0, 0.4, 1],
              extrapolate: "clamp",
            }),
            transform: [
              {
                scale: panX.interpolate({
                  inputRange: [0, 42],
                  outputRange: [0.6, 1.1],
                  extrapolate: "clamp",
                }),
              },
            ],
          },
        ]}
      >
        <View style={styles.replyIconCircle}>
          <Ionicons name="arrow-undo" size={16} color="#ffffff" />
        </View>
      </Animated.View>

      {/* Swipeable & double-tappable Message Content */}
      <Animated.View
        {...panResponder.panHandlers}
        style={{ transform: [{ translateX: panX }] }}
      >
        <Pressable
          onPress={handlePress}
          onLongPress={onLongPress}
          delayLongPress={350}
        >
          {children}
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "relative",
    width: "100%",
    justifyContent: "center",
  },
  replyIconContainer: {
    position: "absolute",
    left: 8,
    top: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1,
  },
  replyIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#1d68ec",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
  },
});
