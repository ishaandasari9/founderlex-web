import { useRef, useState } from 'react';
import { motion, useMotionValue, useSpring } from 'motion/react';

const springValues = { damping: 30, stiffness: 100, mass: 2 };

export default function TiltedCard({
  imageSrc,
  altText = 'Tilted card image',
  captionText = '',
  containerHeight = '300px',
  containerWidth = '100%',
  imageHeight = '300px',
  imageWidth = '300px',
  scaleOnHover = 1.1,
  rotateAmplitude = 14,
  showMobileWarning = false,
  showTooltip = false,
  overlayContent = null,
  displayOverlayContent = false,
}) {
  const ref = useRef(null);

  // Input motion values (targets we set directly)
  const rotXInput = useMotionValue(0);
  const rotYInput = useMotionValue(0);

  // Spring-smoothed outputs applied to the element
  const rotateX = useSpring(rotXInput, springValues);
  const rotateY = useSpring(rotYInput, springValues);

  // Scale and tooltip helpers
  const scale = useSpring(1, springValues);
  const opacity = useSpring(0);
  const rotateFigcaption = useSpring(0, { stiffness: 350, damping: 30, mass: 1 });
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const [lastY, setLastY] = useState(0);

  function handleMouse(e) {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const offsetX = e.clientX - rect.left - rect.width / 2;
    const offsetY = e.clientY - rect.top - rect.height / 2;
    // Set the INPUT values — springs animate toward these
    rotXInput.set((offsetY / (rect.height / 2)) * -rotateAmplitude);
    rotYInput.set((offsetX / (rect.width / 2)) * rotateAmplitude);
    x.set(e.clientX - rect.left);
    y.set(e.clientY - rect.top);
    rotateFigcaption.set(-(offsetY - lastY) * 0.6);
    setLastY(offsetY);
  }

  return (
    <figure
      ref={ref}
      onMouseMove={handleMouse}
      onMouseEnter={() => { scale.set(scaleOnHover); opacity.set(1); }}
      onMouseLeave={() => {
        opacity.set(0);
        scale.set(1);
        rotXInput.set(0);
        rotYInput.set(0);
        rotateFigcaption.set(0);
      }}
      style={{
        position: 'relative',
        height: containerHeight,
        width: containerWidth,
        perspective: '800px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        margin: 0,
        padding: 0,
        cursor: 'pointer',
      }}
    >
      <motion.div
        style={{
          width: imageWidth,
          height: imageHeight,
          rotateX,
          rotateY,
          scale,
          position: 'relative',
          transformStyle: 'preserve-3d',
        }}
      >
        {imageSrc && (
          <motion.img
            src={imageSrc}
            alt={altText}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: imageWidth,
              height: imageHeight,
              objectFit: 'cover',
              borderRadius: 15,
              willChange: 'transform',
            }}
          />
        )}
        {displayOverlayContent && overlayContent && (
          <motion.div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              zIndex: 2,
              width: '100%',
              height: '100%',
            }}
          >
            {overlayContent}
          </motion.div>
        )}
      </motion.div>

      {showTooltip && captionText && (
        <motion.figcaption
          style={{
            pointerEvents: 'none',
            position: 'absolute',
            left: 0,
            top: 0,
            borderRadius: 4,
            background: '#fff',
            padding: '4px 10px',
            fontSize: 10,
            color: '#2d2d2d',
            opacity,
            x,
            y,
            rotate: rotateFigcaption,
            zIndex: 3,
          }}
        >
          {captionText}
        </motion.figcaption>
      )}
    </figure>
  );
}
