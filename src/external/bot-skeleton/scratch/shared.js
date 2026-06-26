import filesaver from 'file-saver';
import { getContractTypeOptions as getContractTypeOptionsFromCommon } from '../../../components/shared/utils/common-data';
import { config } from '../constants/config';

export const saveAs = ({ data, filename, type }) => {
    const blob = new Blob([data], { type });
    filesaver.saveAs(blob, filename);
};

export const getContractTypeOptions = (contract_type, trade_type) => {
    // First try to get from config
    if (trade_type && trade_type !== 'na' && trade_type !== '') {
        const trade_types = config().opposites[trade_type.toUpperCase()];

        if (trade_types) {
            const contract_options = trade_types.map(type => Object.entries(type)[0].reverse());

            // When user selected a specific contract, only return the contract type they selected.
            if (contract_type !== 'both') {
                const filtered_options = contract_options.filter(option => option[1] === contract_type);
                return filtered_options;
            }
            return contract_options;
        }
    }

    // Fallback to common data
    return getContractTypeOptionsFromCommon(contract_type, trade_type);
};
