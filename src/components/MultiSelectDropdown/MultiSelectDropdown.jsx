import React from "react";
import {
    TextField,
    Autocomplete,
    Chip,
    createFilterOptions,
    Paper,
} from "@mui/material";

const filter = createFilterOptions();

const MultiSelectDropdown = ({
    onChange,
    placeholder,
    dynamicWindowWidth,
    optionToAdd,
    options,
    ...autocompleteProps
}) => {
    return (
        <Autocomplete
            {...autocompleteProps}
            multiple
            freeSolo
            disableCloseOnSelect
            limitTags={3}
            getOptionLabel={(option) => option.label}
            onChange={(event, newValue) => {
                onChange(newValue);
            }}
            options={options ?? []}
            value={autocompleteProps.value ?? []}
            filterOptions={(options, params) => {
                const filtered = filter(options, params);

                const { inputValue } = params;
                // Suggest the creation of a new value
                const optionExists = options.some(
                    (option) => inputValue === option.label
                );
                if (inputValue !== "" && !optionExists && optionToAdd) {
                    filtered.push({
                        value: inputValue,
                        label: ` ${inputValue}`,
                    });
                }

                return filtered;
            }}
            PaperComponent={({ children }) => (
                <Paper style={{ background: "aliceblue" }}>{children}</Paper>
            )}
            sx={{
                backgroundColor: "aliceblue",
                width: dynamicWindowWidth ?? 250,
                borderRadius: "5px",
                fontFamily: "Figtree, Roboto, Rubik, Noto Kufi Arabic, Noto Sans JP, sans-serif",

            }}
            renderInput={(params) => <TextField {...params} label={placeholder} />}
        />
    );
}

export default MultiSelectDropdown;