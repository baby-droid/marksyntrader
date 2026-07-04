import { default as React, ReactNode } from 'react';

type TabProps = {
    children?: ReactNode;
    icon?: ReactNode;
    title: string | JSX.Element;
    className?: string;
};
declare const Tab: ({ children }: TabProps) => React.JSX.Element;
export default Tab;
