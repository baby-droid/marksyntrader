import React, { useEffect, useRef, useState } from 'react';

/**
 * Free-typing numeric input.
 *
 * Plain controlled `<input type='number'>` fields that clamp on every
 * keystroke (e.g. `Math.max(min, +e.target.value)`) make it impossible to
 * clear the field and retype a value — clearing it briefly evaluates to 0,
 * which snaps straight back to `min`. This component keeps its own local
 * text buffer while focused (so partial/empty input is allowed) and only
 * parses + clamps + commits the numeric value on blur or Enter.
 */
const NumberField: React.FC<{
    value: number;
    onCommit: (n: number) => void;
    min?: number;
    max?: number;
    disabled?: boolean;
    className?: string;
    placeholder?: string;
}> = ({ value, onCommit, min, max, disabled, className, placeholder }) => {
    const [text, setText] = useState(String(value));
    const focusedRef = useRef(false);

    useEffect(() => {
        if (!focusedRef.current) setText(String(value));
    }, [value]);

    const commit = () => {
        focusedRef.current = false;
        let n = parseFloat(text);
        if (Number.isNaN(n)) n = value;
        if (min != null) n = Math.max(min, n);
        if (max != null) n = Math.min(max, n);
        setText(String(n));
        if (n !== value) onCommit(n);
    };

    return (
        <input
            type='text'
            inputMode='decimal'
            className={`num-field ${className || ''}`}
            disabled={disabled}
            placeholder={placeholder}
            value={text}
            onFocus={() => { focusedRef.current = true; }}
            onChange={e => {
                const v = e.target.value;
                if (v === '' || /^-?\d*\.?\d*$/.test(v)) setText(v);
            }}
            onBlur={commit}
            onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
        />
    );
};

export default NumberField;
