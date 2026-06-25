import React, { useState, Children, useRef, useLayoutEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';

// FounderLex brand colors
const RED = '#DB1A1A';
const INK = '#2A2420';
const CREAM = '#F7F2EB';
const MUTED = '#9B8F82';
const BORDER = 'rgba(42,36,32,0.12)';

export default function Stepper({
  children,
  initialStep = 1,
  onStepChange = () => {},
  onFinalStepCompleted = () => {},
  backButtonText = 'Back',
  nextButtonText = 'Continue',
  disableStepIndicators = false,
  renderStepIndicator,
  ...rest
}) {
  const [currentStep, setCurrentStep] = useState(initialStep);
  const [direction, setDirection] = useState(0);
  const steps = Children.toArray(children);
  const total = steps.length;
  const isCompleted = currentStep > total;
  const isLast = currentStep === total;

  const update = (n) => {
    setCurrentStep(n);
    if (n > total) onFinalStepCompleted();
    else onStepChange(n);
  };

  return (
    <div style={{ display: 'flex', minHeight: '100%', flex: '1 1 0', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '1rem' }} {...rest}>
      <div style={{ margin: '0 auto', width: '100%', maxWidth: '28rem', borderRadius: '2rem', border: `1px solid ${BORDER}`, boxShadow: '0 20px 50px -30px rgba(42,36,32,0.25)', background: '#fff' }}>

        {/* Step indicators */}
        <div style={{ display: 'flex', width: '100%', alignItems: 'center', padding: '2rem' }}>
          {steps.map((_, idx) => {
            const n = idx + 1;
            const notLast = idx < total - 1;
            return (
              <React.Fragment key={n}>
                {renderStepIndicator ? renderStepIndicator({ step: n, currentStep, onStepClick: (c) => { setDirection(c > currentStep ? 1 : -1); update(c); } }) : (
                  <StepIndicator step={n} currentStep={currentStep} disabled={disableStepIndicators}
                    onClick={() => { if (n !== currentStep && !disableStepIndicators) { setDirection(n > currentStep ? 1 : -1); update(n); } }} />
                )}
                {notLast && <StepConnector done={currentStep > n} />}
              </React.Fragment>
            );
          })}
        </div>

        {/* Content */}
        <ContentWrapper isCompleted={isCompleted} currentStep={currentStep} direction={direction}>
          {steps[currentStep - 1]}
        </ContentWrapper>

        {/* Footer */}
        {!isCompleted && (
          <div style={{ padding: '0 2rem 2rem' }}>
            <div style={{ marginTop: '2.5rem', display: 'flex', justifyContent: currentStep !== 1 ? 'space-between' : 'flex-end' }}>
              {currentStep !== 1 && (
                <button onClick={() => { setDirection(-1); update(currentStep - 1); }}
                  style={{ background: 'none', border: 'none', padding: '0.25rem 0.5rem', color: MUTED, cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, transition: 'color .2s' }}
                  onMouseEnter={e => e.target.style.color = INK} onMouseLeave={e => e.target.style.color = MUTED}>
                  {backButtonText}
                </button>
              )}
              <button onClick={() => { setDirection(1); isLast ? update(total + 1) : update(currentStep + 1); }}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 9999, background: RED, color: '#fff', fontWeight: 500, letterSpacing: '-0.025em', padding: '0.4rem 1rem', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 15, transition: 'background .15s', boxShadow: '0 8px 20px -10px rgba(219,26,26,0.5)' }}
                onMouseEnter={e => e.target.style.background = '#C21717'} onMouseLeave={e => e.target.style.background = RED}>
                {isLast ? 'Let\'s go →' : nextButtonText}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ContentWrapper({ isCompleted, currentStep, direction, children }) {
  const [height, setHeight] = useState(0);
  return (
    <motion.div style={{ position: 'relative', overflow: 'hidden' }} animate={{ height: isCompleted ? 0 : height }} transition={{ type: 'spring', duration: 0.4 }}>
      <AnimatePresence initial={false} mode="sync" custom={direction}>
        {!isCompleted && (
          <Slide key={currentStep} direction={direction} onHeight={setHeight}>
            {children}
          </Slide>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function Slide({ children, direction, onHeight }) {
  const ref = useRef(null);
  useLayoutEffect(() => { if (ref.current) onHeight(ref.current.offsetHeight); }, [children, onHeight]);
  return (
    <motion.div ref={ref} custom={direction}
      variants={{ enter: d => ({ x: d >= 0 ? '-100%' : '100%', opacity: 0 }), center: { x: '0%', opacity: 1 }, exit: d => ({ x: d >= 0 ? '50%' : '-50%', opacity: 0 }) }}
      initial="enter" animate="center" exit="exit" transition={{ duration: 0.4 }}
      style={{ position: 'absolute', left: 0, right: 0, top: 0, padding: '0 2rem' }}>
      {children}
    </motion.div>
  );
}

export function Step({ children }) {
  return <div style={{ paddingBottom: '0.5rem' }}>{children}</div>;
}

function StepIndicator({ step, currentStep, disabled, onClick }) {
  const status = currentStep === step ? 'active' : currentStep < step ? 'inactive' : 'done';
  return (
    <motion.div onClick={onClick} style={{ position: 'relative', cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.5 : 1 }} animate={status} initial={false}>
      <motion.div variants={{
        inactive: { scale: 1, backgroundColor: '#F2EAE0', color: MUTED },
        active: { scale: 1, backgroundColor: RED, color: RED },
        done: { scale: 1, backgroundColor: RED, color: RED },
      }} transition={{ duration: 0.3 }}
        style={{ display: 'flex', height: 32, width: 32, alignItems: 'center', justifyContent: 'center', borderRadius: '50%', fontWeight: 600 }}>
        {status === 'done' ? (
          <CheckIcon style={{ height: 16, width: 16, color: '#fff' }} />
        ) : status === 'active' ? (
          <div style={{ height: 12, width: 12, borderRadius: '50%', background: '#fff' }} />
        ) : (
          <span style={{ fontSize: 14, color: MUTED }}>{step}</span>
        )}
      </motion.div>
    </motion.div>
  );
}

function StepConnector({ done }) {
  return (
    <div style={{ position: 'relative', marginLeft: 8, marginRight: 8, height: 2, flex: 1, overflow: 'hidden', borderRadius: 4, background: '#F2EAE0' }}>
      <motion.div variants={{ incomplete: { width: 0 }, complete: { width: '100%', backgroundColor: RED } }}
        initial={false} animate={done ? 'complete' : 'incomplete'} transition={{ duration: 0.4 }}
        style={{ position: 'absolute', left: 0, top: 0, height: '100%' }} />
    </div>
  );
}

function CheckIcon(props) {
  return (
    <svg {...props} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <motion.path initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 0.1, type: 'tween', ease: 'easeOut', duration: 0.3 }} strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}
