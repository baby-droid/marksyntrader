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
            <div className='chart-native-control chart-native-control--chart'>
                <ChartMode portalNodeId='modal_root' onChartType={updateChartType} onGranularity={updateGranularity} />
            </div>
            {/* Indicators / studies — always visible */}
            <div className='chart-native-control chart-native-control--study'>
                <StudyLegend portalNodeId='modal_root' searchInputClassName='data-hj-whitelist' />
            </div>
            {/* Saved views */}
            <div className='chart-native-control chart-native-control--views'>
                <Views
                    portalNodeId='modal_root'
                    onChartType={updateChartType}
                    onGranularity={updateGranularity}
                    searchInputClassName='data-hj-whitelist'
                />
            </div>
            {/* Drawing tools — always visible */}
            <div className='chart-native-control chart-native-control--drawing'>
                <DrawTools portalNodeId='modal_root' />
            </div>
            {/* Download / Share — always visible */}
            <div className='chart-native-control chart-native-control--share'>
                <Share portalNodeId='modal_root' />
            </div>
        </ToolbarWidget>
    );
};

export default memo(ToolbarWidgets);
