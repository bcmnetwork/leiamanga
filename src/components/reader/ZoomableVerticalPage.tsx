import { Image } from 'expo-image';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from 'react-native-reanimated';

interface ZoomableVerticalPageProps {
  uri: string;
  width: number;
  height: number;
  onTap: () => void;
  onZoomChange: (zoomed: boolean) => void;
  onLoad: (width: number, height: number) => void;
}

/** Pinch/double-tap zoomable page for the vertical (scroll) reader, sized to its own aspect ratio. */
export function ZoomableVerticalPage({ uri, width, height, onTap, onZoomChange, onLoad }: ZoomableVerticalPageProps) {
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);
  const [zoomed, setZoomed] = useState(false);
  const [loading, setLoading] = useState(true);

  const notifyZoomChange = (value: boolean) => {
    setZoomed(value);
    onZoomChange(value);
  };

  const resetZoom = () => {
    'worklet';
    scale.value = withTiming(1);
    translateX.value = withTiming(0);
    translateY.value = withTiming(0);
    savedScale.value = 1;
    savedTranslateX.value = 0;
    savedTranslateY.value = 0;
  };

  const pinch = Gesture.Pinch()
    .onUpdate((event) => {
      scale.value = Math.max(1, Math.min(savedScale.value * event.scale, 4));
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      if (scale.value <= 1.02) {
        resetZoom();
        runOnJS(notifyZoomChange)(false);
      } else {
        runOnJS(notifyZoomChange)(true);
      }
    });

  const pan = Gesture.Pan()
    .enabled(zoomed)
    .onUpdate((event) => {
      if (savedScale.value <= 1) return;
      translateX.value = savedTranslateX.value + event.translationX;
      translateY.value = savedTranslateY.value + event.translationY;
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd((event) => {
      const next = savedScale.value > 1 ? 1 : 2.5;
      if (next === 1) {
        translateX.value = withTiming(0);
        translateY.value = withTiming(0);
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
      } else {
        // Keep the tapped point under the finger by translating it back to
        // center as we scale up around the view's center.
        const targetX = next * (width / 2 - event.x);
        const targetY = next * (height / 2 - event.y);
        translateX.value = withTiming(targetX);
        translateY.value = withTiming(targetY);
        savedTranslateX.value = targetX;
        savedTranslateY.value = targetY;
      }
      scale.value = withTiming(next);
      savedScale.value = next;
      runOnJS(notifyZoomChange)(next > 1);
    });

  const singleTap = Gesture.Tap()
    .numberOfTaps(1)
    .onEnd(() => {
      runOnJS(onTap)();
    });

  const composedTap = Gesture.Exclusive(doubleTap, singleTap);
  const composed = Gesture.Simultaneous(pinch, pan, composedTap);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <GestureDetector gesture={composed}>
      <Animated.View style={[{ width, height }, animatedStyle]}>
        <Image
          source={{ uri }}
          style={styles.image}
          contentFit="contain"
          onLoadStart={() => setLoading(true)}
          onLoad={(event) => {
            setLoading(false);
            const { width: w, height: h } = event.source;
            if (w && h) onLoad(w, h);
          }}
          onError={() => setLoading(false)}
        />
        {loading ? (
          <ActivityIndicator style={styles.loading} size="large" color="#fff" />
        ) : null}
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  image: {
    width: '100%',
    height: '100%',
  },
  loading: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
});
