import { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import Svg, { Circle, Defs, Ellipse, G, Line, LinearGradient, Path, RadialGradient, Rect, Stop, Text as SvgText } from 'react-native-svg';

export type CharacterMood = 'idle' | 'watching' | 'hiding' | 'peeking' | 'thinking' | 'error' | 'offline' | 'success' | 'poked';

const EYE_L_CX = 155.5;
const EYE_R_CX = 184.5;
const EYE_CY = 196.5;
const PUPIL_MAX_X = 2.2;
const PUPIL_MAX_Y = 3.4;

interface LoginCharacterProps {
  mood?: CharacterMood;
  size?: number;
  /** -1..1, eyes/body lean toward this point (touch position, or the focused input) */
  gazeX?: number;
  gazeY?: number;
  /** bump this to restart the poke animation even if mood was already 'poked' */
  pokeKey?: number;
}

const LoginCharacter = ({ mood = 'idle', size = 220, gazeX = 0, gazeY = 0, pokeKey = 0 }: LoginCharacterProps) => {
  const gx = Math.max(-1, Math.min(1, gazeX));
  const gy = Math.max(-1, Math.min(1, gazeY));
  const tracksGaze = mood === 'idle' || mood === 'watching' || mood === 'peeking';
  const pupilDx = tracksGaze ? gx * PUPIL_MAX_X : 0;
  const pupilDy = tracksGaze ? gy * PUPIL_MAX_Y : 0;
  const bodyX = tracksGaze ? gx * 7 : 0;
  const bodyY = tracksGaze ? gy * 5 : 0;
  const bodyRot = tracksGaze ? gx * 11 : 0;
  const bob = useRef(new Animated.Value(0)).current;
  const poke = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(bob, { toValue: 0, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true })
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [bob]);

  useEffect(() => {
    if (!pokeKey) return;
    poke.setValue(0);
    Animated.sequence([
      Animated.timing(poke, { toValue: 1, duration: 110, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.spring(poke, { toValue: 0, friction: 3.5, tension: 140, useNativeDriver: true })
    ]).start();
  }, [pokeKey, poke]);

  const translateY = bob.interpolate({ inputRange: [0, 1], outputRange: mood === 'error' ? [0, 0] : [0, -8] });
  const pokeScale = poke.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] });

  const arms = (() => {
    if (mood === 'hiding') {
      return (
        <>
          <Path d="M124,205 Q110,185 151,193" stroke="#ffffff" strokeWidth={18} strokeLinecap="round" fill="none" />
          <Circle cx={151} cy={194} r={15} fill="#ffffff" />
          <Path d="M216,205 Q230,185 189,193" stroke="#ffffff" strokeWidth={18} strokeLinecap="round" fill="none" />
          <Circle cx={189} cy={194} r={15} fill="#ffffff" />
        </>
      );
    }
    if (mood === 'peeking') {
      return (
        <>
          <Path d="M124,205 Q112,196 149,213" stroke="#ffffff" strokeWidth={18} strokeLinecap="round" fill="none" />
          <Circle cx={149} cy={214} r={14} fill="#ffffff" />
          <Path d="M216,205 Q228,196 191,213" stroke="#ffffff" strokeWidth={18} strokeLinecap="round" fill="none" />
          <Circle cx={191} cy={214} r={14} fill="#ffffff" />
        </>
      );
    }
    if (mood === 'error') {
      return (
        <>
          <Path d="M124,200 Q90,196 80,212" stroke="#ffffff" strokeWidth={18} strokeLinecap="round" fill="none" />
          <Circle cx={80} cy={214} r={12} fill="#ffffff" />
          <Path d="M216,200 Q250,196 260,212" stroke="#ffffff" strokeWidth={18} strokeLinecap="round" fill="none" />
          <Circle cx={260} cy={214} r={12} fill="#ffffff" />
        </>
      );
    }
    if (mood === 'success') {
      return (
        <>
          <Path d="M124,205 Q100,160 90,118" stroke="#ffffff" strokeWidth={18} strokeLinecap="round" fill="none" />
          <Circle cx={90} cy={116} r={12} fill="#ffffff" />
          <Path d="M216,205 Q240,160 250,118" stroke="#ffffff" strokeWidth={18} strokeLinecap="round" fill="none" />
          <Circle cx={250} cy={116} r={12} fill="#ffffff" />
        </>
      );
    }
    if (mood === 'poked') {
      return (
        <>
          <Path d="M124,203 Q92,180 76,140" stroke="#ffffff" strokeWidth={18} strokeLinecap="round" fill="none" />
          <Circle cx={74} cy={136} r={12} fill="#ffffff" />
          <Path d="M216,203 Q248,180 264,140" stroke="#ffffff" strokeWidth={18} strokeLinecap="round" fill="none" />
          <Circle cx={266} cy={136} r={12} fill="#ffffff" />
        </>
      );
    }
    return (
      <>
        <Path d="M124,205 Q95,220 92,258" stroke="#ffffff" strokeWidth={20} strokeLinecap="round" fill="none" />
        <Circle cx={92} cy={261} r={13} fill="#ffffff" />
        <Path d="M216,205 Q245,220 248,258" stroke="#ffffff" strokeWidth={20} strokeLinecap="round" fill="none" />
        <Circle cx={248} cy={261} r={13} fill="#ffffff" />
      </>
    );
  })();

  const eyes = (() => {
    if (mood === 'thinking') {
      return (
        <>
          <Rect x={149} y={195} width={12} height={3} rx={1.5} fill="#ffffff" />
          <Rect x={178} y={195} width={12} height={3} rx={1.5} fill="#ffffff" />
        </>
      );
    }
    if (mood === 'offline') {
      return (
        <>
          <Circle cx={156} cy={197} r={4} fill="#ffffff" />
          <Circle cx={184} cy={197} r={4} fill="#ffffff" />
        </>
      );
    }
    if (mood === 'error') {
      return (
        <G>
          <Path d="M148,188 L161,192" stroke="#ffffff" strokeWidth={2.4} strokeLinecap="round" />
          <Path d="M192,188 L179,192" stroke="#ffffff" strokeWidth={2.4} strokeLinecap="round" />
          <Rect x={151} y={192} width={9} height={12} rx={4.5} fill="#ffffff" />
          <Rect x={180} y={192} width={9} height={12} rx={4.5} fill="#ffffff" />
        </G>
      );
    }
    if (mood === 'success') {
      return (
        <>
          <Path d="M148,200 Q155,190 162,200" stroke="#ffffff" strokeWidth={3} fill="none" strokeLinecap="round" />
          <Path d="M178,200 Q185,190 192,200" stroke="#ffffff" strokeWidth={3} fill="none" strokeLinecap="round" />
        </>
      );
    }
    if (mood === 'poked') {
      return (
        <>
          <Circle cx={EYE_L_CX} cy={EYE_CY} r={7} fill="#ffffff" />
          <Circle cx={EYE_R_CX} cy={EYE_CY} r={7} fill="#ffffff" />
          <Circle cx={EYE_L_CX} cy={EYE_CY} r={3.4} fill="#0b4f47" />
          <Circle cx={EYE_R_CX} cy={EYE_CY} r={3.4} fill="#0b4f47" />
        </>
      );
    }
    return (
      <G>
        <Rect x={151} y={190} width={9} height={13} rx={4.5} fill="#ffffff" />
        <Rect x={180} y={190} width={9} height={13} rx={4.5} fill="#ffffff" />
        <Circle cx={EYE_L_CX + pupilDx} cy={EYE_CY + pupilDy} r={2.3} fill="#0b4f47" />
        <Circle cx={EYE_R_CX + pupilDx} cy={EYE_CY + pupilDy} r={2.3} fill="#0b4f47" />
      </G>
    );
  })();

  const mouth = (() => {
    if (mood === 'thinking') return <Path d="M156,218 L184,218" stroke="#ffffff" strokeWidth={4} strokeLinecap="round" />;
    if (mood === 'error') return <Path d="M150,224 Q170,210 190,224" stroke="#ffffff" strokeWidth={4} fill="none" strokeLinecap="round" />;
    if (mood === 'offline')
      return (
        <Path
          d="M148,218 Q156,224 164,218 Q172,212 180,218 Q188,224 194,218"
          stroke="#ffffff"
          strokeWidth={3}
          fill="none"
          strokeLinecap="round"
        />
      );
    if (mood === 'success') return <Path d="M144,210 Q170,240 196,210" stroke="#ffffff" strokeWidth={4.5} fill="none" strokeLinecap="round" />;
    if (mood === 'peeking') return <Circle cx={170} cy={217} r={5} fill="none" stroke="#ffffff" strokeWidth={3} />;
    if (mood === 'poked') return <Ellipse cx={170} cy={218} rx={7} ry={9} fill="#ffffff" />;
    return <Path d="M150,214 Q170,226 190,214" stroke="#ffffff" strokeWidth={4} fill="none" strokeLinecap="round" />;
  })();

  const antenna = (() => {
    if (mood === 'offline') {
      return (
        <G opacity={0.55}>
          <Path d="M170,140 Q180,126 173,113" stroke="#ffffff" strokeWidth={5} strokeLinecap="round" fill="none" />
          <Circle cx={173} cy={112} r={6} fill="#fbbf24" />
        </G>
      );
    }
    const glowR = mood === 'success' ? 18 : 14;
    return (
      <>
        <Line x1={170} y1={140} x2={170} y2={115} stroke="#ffffff" strokeWidth={5} strokeLinecap="round" />
        <Circle cx={170} cy={108} r={glowR} fill="#fbbf24" opacity={0.25} />
        <Circle cx={170} cy={108} r={7} fill="#fbbf24" />
      </>
    );
  })();

  return (
    <Animated.View style={{ width: size, height: size, transform: [{ translateY }, { scale: pokeScale }] }}>
      <Svg viewBox="0 0 340 420" width="100%" height="100%">
        <Defs>
          <LinearGradient id="charBody" x1="15%" y1="10%" x2="90%" y2="100%">
            <Stop offset="0%" stopColor="#ffffff" />
            <Stop offset="55%" stopColor="#f2f7f7" />
            <Stop offset="100%" stopColor="#cfe0e0" />
          </LinearGradient>
          <LinearGradient id="charFace" x1="20%" y1="0%" x2="80%" y2="100%">
            <Stop offset="0%" stopColor="#12564f" />
            <Stop offset="100%" stopColor="#082e2a" />
          </LinearGradient>
          <RadialGradient id="charHighlight" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor="#ffffff" stopOpacity={0.75} />
            <Stop offset="100%" stopColor="#ffffff" stopOpacity={0} />
          </RadialGradient>
        </Defs>

        <G transform="translate(50,80)">
          <Path d="M-15,6 L0,-12 L15,6 Z" fill="#fbbf24" />
          <Rect x={-12} y={6} width={24} height={20} rx={3} fill="#ffffff" fillOpacity={0.92} />
          <Rect x={-4} y={16} width={8} height={10} fill="#0b4f47" />
        </G>
        <G transform="translate(280,95)">
          <Circle cx={0} cy={0} r={17} fill="#fbbf24" />
          <SvgText x={0} y={6} textAnchor="middle" fontSize={18} fontWeight="700" fill="#ffffff">
            {'₹'}
          </SvgText>
        </G>
        <G transform="translate(270,292)">
          <Circle cx={0} cy={0} r={16} fill="#ffffff" />
          <Path d="M-8,0 L-2,6 L10,-8" stroke="#0f766e" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </G>

        <Ellipse cx={170} cy={378} rx={66} ry={13} fill="rgba(255,255,255,0.28)" />

        {mood === 'poked' && (
          <G stroke="#fbbf24" strokeWidth={4} strokeLinecap="round">
            <Line x1={170} y1={60} x2={170} y2={40} />
            <Line x1={146} y1={68} x2={130} y2={52} />
            <Line x1={194} y1={68} x2={210} y2={52} />
          </G>
        )}

        <G transform={`translate(${bodyX}, ${bodyY}) rotate(${bodyRot}, 170, 300)`}>
          <Rect x={115} y={140} width={110} height={170} rx={55} fill="url(#charBody)" stroke="rgba(15,118,110,0.18)" strokeWidth={2} />
          <Ellipse cx={146} cy={172} rx={26} ry={34} fill="url(#charHighlight)" transform="rotate(-18 146 172)" />
          {antenna}
          <Rect x={133} y={170} width={74} height={58} rx={18} fill="url(#charFace)" />
          {eyes}
          {mouth}
          {arms}
        </G>
      </Svg>
    </Animated.View>
  );
};

export default LoginCharacter;
