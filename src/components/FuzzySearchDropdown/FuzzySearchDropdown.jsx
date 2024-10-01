import React, {useState} from 'react'
import MultiSelectDropdown from '../MultiSelectDropdown/MultiSelectDropdown'



const FuzzySearchDropdown = () => {
    const searchOptions = []
    const [selectedSearchOptions, setSelectedSearchOptions] = useState([])
  return (
    <div>
            <div
                                style={{
                                    display: "flex",
                                    justifyContent: "space-around",
                                    paddingRight: "20px",
                                    paddingLeft: "20px"
                                }}
                            >
                                <MultiSelectDropdown
                                    placeholder="Search for articles"
                                    options={searchOptions ?? []}
                                    value={selectedSearchOptions}
                                    onChange={setSelectedSearchOptions}
                                    getOptionLabel={(option) => option.label}
                                    optionToAdd={true}
                                />
                                </div>

    </div>
  )
}

export default FuzzySearchDropdown