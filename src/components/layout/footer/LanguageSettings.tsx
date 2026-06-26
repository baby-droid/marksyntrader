import Text from '@/components/shared_ui/text';
import { LabelPairedGlobeSmRegularIcon } from '@deriv/quill-icons';
import { useTranslations } from '@deriv-com/translations';
import { Tooltip } from '@deriv-com/ui';

type TLanguageSettings = {
    openLanguageSettingModal: () => void;
};

const LanguageSettings = ({ openLanguageSettingModal }: TLanguageSettings) => {
    const { currentLang, localize } = useTranslations();

    return (
        <Tooltip
            as='button'
            className='app-footer__language'
            onClick={openLanguageSettingModal}
            tooltipContent={localize('Language')}
            aria-label={`${localize('Change language')} - ${localize('Current language')}: ${currentLang}`}
            aria-expanded='false'
            aria-haspopup='dialog'
        >
            <LabelPairedGlobeSmRegularIcon />
            <Text size='xs' weight='bold'>
                {currentLang}
            </Text>
        </Tooltip>
    );
};

export default LanguageSettings;
