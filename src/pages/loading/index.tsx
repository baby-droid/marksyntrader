import React, { useEffect, useState } from 'react';
import './loading.scss';

interface LoadingPageProps {
    is_loading: boolean;
}

const LoadingPage: React.FC<LoadingPageProps> = ({ is_loading }) => {
    const [visible, setVisible] = useState(true);
    const [fade, setFade] = useState(false);

    useEffect(() => {
        if (!is_loading) {
            setFade(true);
            const t = setTimeout(() => setVisible(false), 700);
            return () => clearTimeout(t);
        } else {
            setVisible(true);
            setFade(false);
        }
    }, [is_loading]);

    if (!visible) return null;

    return (
        <div className={`ahst-loading${fade ? ' ahst-loading--fade' : ''}`}>
            <div className='ahst-loading__bg' />
            <div className='ahst-loading__grid' />
            <div className='ahst-loading__orbs'>
                <div className='ahst-loading__orb ahst-loading__orb--1' />
                <div className='ahst-loading__orb ahst-loading__orb--2' />
                <div className='ahst-loading__orb ahst-loading__orb--3' />
            </div>
            <div className='ahst-loading__content'>
                <div className='ahst-loading__logo'>
                    <span className='ahst-loading__logo-d'>D</span>
                </div>
                <h1 className='ahst-loading__title'>AHMEDSYNTRADERSITE</h1>
                <p className='ahst-loading__subtitle'>Advanced AI Trading Platform</p>
                <div className='ahst-loading__bar-wrap'>
                    <div className='ahst-loading__bar' />
                </div>
                <div className='ahst-loading__dots'>
                    <span /><span /><span /><span /><span />
                </div>
                <p className='ahst-loading__status'>Initializing trading engine…</p>
            </div>
        </div>
    );
};

export default LoadingPage;
