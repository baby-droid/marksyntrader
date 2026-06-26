import React from 'react';

type AuthLoadingWrapperProps = {
    children: React.ReactNode;
};

const AuthLoadingWrapper = ({ children }: AuthLoadingWrapperProps) => {
    return <>{children}</>;
};

export default AuthLoadingWrapper;
