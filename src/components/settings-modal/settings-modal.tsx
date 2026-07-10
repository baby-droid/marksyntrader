import { useState } from 'react';
import useThemeSwitcher from '@/hooks/useThemeSwitcher';
import { useStore } from '@/hooks/useStore';
import DesktopWrapper from '../shared_ui/desktop-wrapper';
import MobileDialog from '../shared_ui/mobile-dialog';
import MobileWrapper from '../shared_ui/mobile-wrapper';
import Modal from '../shared_ui/modal';
import { Localize } from '@deriv-com/translations';
import { ToggleSwitch } from '@deriv-com/ui';
import { getDisplayCurrency, setDisplayCurrency } from '@/utils/currency-display';
import './settings-modal.scss';

type TSettingsModalProps = {
    isOpen: boolean;
    onClose: () => void;
};

const SettingsModal = ({ isOpen, onClose }: TSettingsModalProps) => {
    const { is_dark_mode_on, toggleTheme } = useThemeSwitcher();
    const { client } = useStore() ?? {};
    const [displayCur, setDisplayCur] = useState<'USD' | 'KSH'>(() => getDisplayCurrency());

    const handleCurrencyChange = (currency: 'USD' | 'KSH') => {
        setDisplayCur(currency);
        setDisplayCurrency(currency);
    };

    const content = (
        <div className='settings-modal__content'>
            <div className='settings-modal__section'>
                <div className='settings-modal__row'>
                    <span className='settings-modal__label'>
                        <Localize i18n_default_text='Dark theme' />
                    </span>
                    <ToggleSwitch value={is_dark_mode_on} onChange={toggleTheme} />
                </div>
            </div>

            <div className='settings-modal__section'>
                <div className='settings-modal__section-title'>
                    <Localize i18n_default_text='Display currency' />
                </div>
                <div className='settings-modal__currency-options'>
                    {['USD', 'KSH'].map(cur => (
                        <button
                            key={cur}
                            type='button'
                            className={`settings-modal__currency-btn ${displayCur === cur ? 'settings-modal__currency-btn--active' : ''}`}
                            onClick={() => handleCurrencyChange(cur as 'USD' | 'KSH')}
                        >
                            {cur}
                        </button>
                    ))}
                </div>
            </div>

            {client?.loginid && (
                <div className='settings-modal__section'>
                    <div className='settings-modal__section-title'>
                        <Localize i18n_default_text='Account' />
                    </div>
                    <div className='settings-modal__row'>
                        <span className='settings-modal__label'>
                            <Localize i18n_default_text='Login ID' />
                        </span>
                        <span className='settings-modal__value'>{client.loginid}</span>
                    </div>
                </div>
            )}
        </div>
    );

    return (
        <Modal has_close_icon width='440px' height='auto' is_open={isOpen} toggleModal={onClose} title='Settings'>
            <DesktopWrapper>
                <Modal.Body>{content}</Modal.Body>
            </DesktopWrapper>
            <MobileWrapper>
                <MobileDialog portal_element_id='modal_root' has_close_icon visible={isOpen} onClose={onClose}>
                    <Modal.Body>{content}</Modal.Body>
                </MobileDialog>
            </MobileWrapper>
        </Modal>
    );
};

export default SettingsModal;
