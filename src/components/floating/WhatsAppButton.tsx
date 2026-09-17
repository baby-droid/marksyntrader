import React, { useState } from 'react';
import './whatsapp-button.scss';

const WA_GROUP = 'https://chat.whatsapp.com/EkscsxyF4j0CpuWzv0bqUw';
const WA_PHONE = '0705486402';

const WA_SVG = (
    <svg viewBox='0 0 32 32' fill='none' xmlns='http://www.w3.org/2000/svg' className='wa-fab__icon'>
        <circle cx='16' cy='16' r='16' fill='#25D366' />
        <path
            d='M23.5 8.5C21.7 6.7 19.3 5.7 16.7 5.7C11.4 5.7 7 10.1 7 15.4C7 17.1 7.5 18.8 8.3 20.2L7 25L12 23.7C13.4 24.5 14.9 24.9 16.5 24.9H16.6C21.9 24.9 26.3 20.5 26.3 15.2C26.3 12.6 25.3 10.3 23.5 8.5ZM16.6 23.2C15.2 23.2 13.8 22.8 12.6 22.1L12.3 21.9L9.2 22.7L10 19.7L9.8 19.4C9 18.1 8.6 16.8 8.6 15.4C8.6 11 12.2 7.4 16.6 7.4C18.7 7.4 20.7 8.2 22.2 9.7C23.7 11.2 24.5 13.2 24.5 15.3C24.6 19.7 21 23.2 16.6 23.2ZM21 17.5C20.8 17.4 19.6 16.8 19.4 16.7C19.2 16.6 19 16.6 18.9 16.8C18.7 17 18.2 17.6 18.1 17.8C17.9 18 17.8 18 17.6 17.9C16.8 17.5 16.1 17 15.5 16.4C15 15.8 14.5 15.2 14.2 14.5C14.1 14.3 14.2 14.1 14.3 14C14.4 13.9 14.6 13.7 14.7 13.6C14.8 13.5 14.9 13.3 14.9 13.2C15 13.1 14.9 12.9 14.9 12.8C14.8 12.7 14.3 11.5 14.1 11C13.9 10.5 13.7 10.6 13.6 10.6H13.2C13 10.6 12.8 10.7 12.6 10.9C12.4 11.1 11.8 11.7 11.8 12.9C11.8 14.1 12.7 15.2 12.8 15.4C12.9 15.5 14.3 17.7 16.5 18.8C17 19 17.4 19.2 17.8 19.4C18.3 19.6 18.8 19.6 19.2 19.5C19.6 19.4 20.7 18.8 20.9 18.2C21.1 17.6 21.1 17.1 21 17.5Z'
            fill='white'
        />
    </svg>
);

const WhatsAppButton: React.FC = () => {
    const [tooltip, setTooltip] = useState(false);
    const [closed, setClosed] = useState(false);

    if (closed) return null;

    return (
        <div className='wa-fab-wrap'>
            {tooltip && (
                <div className='wa-fab-tooltip'>
                    <p className='wa-fab-tooltip__title'>📲 Join Our WhatsApp Group</p>
                    <p className='wa-fab-tooltip__sub'>Get live signals, tips & support</p>
                    <a className='wa-fab-tooltip__link' href={WA_GROUP} target='_blank' rel='noreferrer'>
                        Join Group →
                    </a>
                    <p className='wa-fab-tooltip__phone'>📞 Call/WhatsApp: {WA_PHONE}</p>
                </div>
            )}
            <div className='wa-fab-group'>
                <a
                    className='wa-fab'
                    href={WA_GROUP}
                    target='_blank'
                    rel='noreferrer'
                    aria-label='Join WhatsApp Group'
                    onMouseEnter={() => setTooltip(true)}
                    onMouseLeave={() => setTooltip(false)}
                >
                    {WA_SVG}
                    <span className='wa-fab__pulse' />
                </a>
                <button
                    className='wa-fab-close'
                    aria-label='Close WhatsApp button'
                    onMouseEnter={() => setTooltip(false)}
                    onClick={() => setClosed(true)}
                >
                    ✕
                </button>
            </div>
        </div>
    );
};

export default WhatsAppButton;
