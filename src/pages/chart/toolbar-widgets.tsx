// @ts-nocheck — vendored bot code with known upstream type gaps; see AGENTS.md
import { memo } from 'react';
import { ChartMode, DrawTools, Share, StudyLegend, ToolbarWidget, Views } from '@deriv-com/smartcharts-champion';
import { useDevice } from '@deriv-com/ui';

type TToolbarWidgetsProps = {
    updateChartType: (chart_type: string) => void;
    updateGranularity: (updateGranularity: number) => void;
    position?: string | null;
    isDesktop?: boolean;
};

const ToolbarWidgets = ({ updateChartType, updateGranularity, position, isDesktop }: TToolbarWidgetsProps) => {
    const { isMobile } = useDevice();
    const validPosition = position === 'top' || position === 'bottom' ? position : 'top';

    return (
        <ToolbarWidget position={validPosition || (isMobile ? 'bottom' : null)}>
            {/* Chart type selector — always visible */}
            <ChartMode portalNodeId='modal_root' onChartType={updateChartType} onGranularity={updateGranularity} />
            {/* Indicators / studies — always visible */}
            <StudyLegend portalNodeId='modal_root' searchInputClassName='data-hj-whitelist' />
            {/* Saved views */}
            <Views
                portalNodeId='modal_root'
                onChartType={updateChartType}
                onGranularity={updateGranularity}
                searchInputClassName='data-hj-whitelist'
            />
            {/* Drawing tools — always visible */}
            <DrawTools portalNodeId='modal_root' />
            {/* Download / Share — always visible */}
            <Share portalNodeId='modal_root' />
        </ToolbarWidget>
    );
};

export default memo(ToolbarWidgets);
