import React from 'react';

type TAccountInfoWrapper = {
    is_disabled?: boolean;
    disabled_message?: string;
    is_mobile?: boolean;
    children: React.ReactNode;
};

const AccountInfoWrapper = ({ is_disabled, children }: TAccountInfoWrapper) => {
    return (
        <div className={`account-info-wrapper ${is_disabled ? 'account-info-wrapper--disabled' : ''}`}>{children}</div>
    );
};

export default AccountInfoWrapper;
