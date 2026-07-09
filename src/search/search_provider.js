import React, { createContext, useContext, useState } from 'react';

// Search term is a lightweight overlay: the header owns the input, and any
// consumer that wants to react to search — currently the home Gallery — reads
// it from this context and folds it into its own filter/fetch logic.

const SearchContext = createContext('');

export const SearchProvider = ({ children }) => {
    const [searchTerm, setSearchTerm] = useState('');

    return (
        <SearchContext.Provider value={{ searchTerm, setSearchTerm }}>
            {children}
        </SearchContext.Provider>
    );
};

export const useSearch = () => useContext(SearchContext);
