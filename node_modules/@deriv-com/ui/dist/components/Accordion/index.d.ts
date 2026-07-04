import { default as React, ReactNode, ComponentProps } from 'react';

type AccordionVariants = "underline" | "bordered" | "shadow";
type AccordionProps = Omit<ComponentProps<"div">, "title"> & {
    children: ReactNode;
    defaultOpen?: boolean;
    isCompact?: boolean;
    onScrollToAccordion?: () => void;
    title: string | JSX.Element;
    variant?: AccordionVariants;
    headerClassName?: string;
    contentClassName?: string;
};
export declare const Accordion: React.ForwardRefExoticComponent<Omit<AccordionProps, "ref"> & React.RefAttributes<HTMLDivElement>>;
export {};
