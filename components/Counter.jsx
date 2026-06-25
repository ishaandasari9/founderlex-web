import { motion, useSpring, useTransform } from 'motion/react';
import { useEffect } from 'react';

function Number({ mv, number, height }) {
  const y = useTransform(mv, latest => {
    const offset = (10 + number - (latest % 10)) % 10;
    let memo = offset * height;
    if (offset > 5) memo -= 10 * height;
    return memo;
  });
  return (
    <motion.span style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', y }}>
      {number}
    </motion.span>
  );
}

function normalizeNear(n) {
  const nearest = Math.round(n);
  return Math.abs(n - nearest) < 1e-9 * Math.max(1, Math.abs(n)) ? nearest : n;
}

function Digit({ place, value, height, digitStyle }) {
  const isDecimal = place === '.';
  const rounded = isDecimal ? 0 : Math.floor(normalizeNear(value / place));
  const animVal = useSpring(rounded);

  useEffect(() => {
    if (!isDecimal) animVal.set(rounded);
  }, [animVal, rounded, isDecimal]);

  if (isDecimal) return (
    <span style={{ position: 'relative', width: 'fit-content', height, ...digitStyle }}>.</span>
  );
  return (
    <span style={{ position: 'relative', width: '1ch', fontVariantNumeric: 'tabular-nums', height, ...digitStyle }}>
      {Array.from({ length: 10 }, (_, i) => <Number key={i} mv={animVal} number={i} height={height} />)}
    </span>
  );
}

export default function Counter({
  value,
  fontSize = 100,
  padding = 0,
  places,
  gap = 8,
  borderRadius = 4,
  horizontalPadding = 8,
  textColor = 'inherit',
  fontWeight = 'bold',
  containerStyle,
  counterStyle,
  digitStyle,
  gradientHeight = 16,
  gradientFrom = 'transparent',
  gradientTo = 'transparent',
  topGradientStyle,
  bottomGradientStyle,
}) {
  const autoPlaces = places ?? [...String(Math.abs(Math.round(value)))].map((ch, i, a) =>
    ch === '.' ? '.' : 10 ** (a.indexOf('.') === -1 ? a.length - i - 1 : i < a.indexOf('.') ? a.indexOf('.') - i - 1 : -(i - a.indexOf('.')))
  );
  const height = fontSize + padding;
  return (
    <span style={{ position: 'relative', display: 'inline-block', ...containerStyle }}>
      <span style={{ display: 'flex', overflow: 'hidden', lineHeight: 1, fontSize, gap, borderRadius, paddingLeft: horizontalPadding, paddingRight: horizontalPadding, color: textColor, fontWeight, direction: 'ltr', ...counterStyle }}>
        {autoPlaces.map((place, i) => <Digit key={i} place={place} value={value} height={height} digitStyle={digitStyle} />)}
      </span>
      <span style={{ pointerEvents: 'none', position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }}>
        <span style={{ position: 'absolute', top: 0, width: '100%', height: gradientHeight, background: `linear-gradient(to bottom, ${gradientFrom}, ${gradientTo})`, ...topGradientStyle }} />
        <span style={{ position: 'absolute', bottom: 0, width: '100%', height: gradientHeight, background: `linear-gradient(to top, ${gradientFrom}, ${gradientTo})`, ...bottomGradientStyle }} />
      </span>
    </span>
  );
}
