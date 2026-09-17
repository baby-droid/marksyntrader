import React from 'react';
import './chunk-loader.scss';

// Custom colored-bar loader — replaces @deriv-com/ui Loader which only accepts a single colour
const BAR_COLORS = ['#ef4444', '#22c55e', '#3b82f6', '#facc15', '#f97316'];

export default function ChunkLoader({ message }: { message: string }) {
    return (
        <div className='app-root'>
            <div className='chunk-loader'>
                <div className='chunk-loader__bars'>
                    {BAR_COLORS.map((color, i) => (
                        <span
                            key={i}
                            className='chunk-loader__bar'
                            style={{ backgroundColor: color, animationDelay: `${i * 0.12}s` }}
                        />
                    ))}
                </div>
            </div>
            <div className='load-message'>{message}</div>
        </div>
    );
}
