import React, { useState } from 'react';
import AiCycleGuide from '@/components/ai-cycle-guide/ai-cycle-guide';
import './cycle-pattern-detector.scss';

const CyclePatternDetector: React.FC = () => {
    const [open, setOpen] = useState(false);

    return (
        <div className='cycle-pattern-detector'>
            <button
                type='button'
                className='run-panel__cycle-trigger'
                title='Open AI Engine Cycle Pattern Detector'
                aria-label='Open AI Engine Cycle Pattern Detector'
                aria-expanded={open}
                onClick={() => setOpen(value => !value)}
            >
                <span /><span /><span /><span />
            </button>
            {open && (
                <section className='cycle-pattern-detector__panel' role='dialog' aria-label='AI Engine Cycle Pattern Detector'>
                    <AiCycleGuide />
                </section>
            )}
        </div>
    );
};

export default CyclePatternDetector;