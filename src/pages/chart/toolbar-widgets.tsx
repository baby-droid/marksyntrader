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
        <div className='smartchart-native-toolbar-proxy'>
            <ToolbarWidget position={validPosition || (isMobile ? 'bottom' : null)}>
                {/* Chart type selector — always available to the visible proxy rail */}
                <div className='chart-native-control--chart'>
                    <ChartMode portalNodeId='modal_root' onChartType={updateChartType} onGranularity={updateGranularity} />
                </div>
                {/* Indicators / studies — always available to the visible proxy rail */}
                <div className='chart-native-control--study'>
                    <StudyLegend portalNodeId='modal_root' searchInputClassName='data-hj-whitelist' />
                </div>
                {/* Saved views */}
                <div className='chart-native-control--views'>
                    <Views
                        portalNodeId='modal_root'
                        onChartType={updateChartType}
                        onGranularity={updateGranularity}
                        searchInputClassName='data-hj-whitelist'
                    />
                </div>
                {/* Drawing tools — always available to the visible proxy rail */}
                <div className='chart-native-control--drawing'>
                    <DrawTools portalNodeId='modal_root' />
                </div>
                {/* Download / Share — always available to the visible proxy rail */}
                <div className='chart-native-control--share'>
                    <Share portalNodeId='modal_root' />
                </div>
            </ToolbarWidget>
        </div>
    );
};

export default memo(ToolbarWidgets);
