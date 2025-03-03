import React, { createContext, useContext, useState, useEffect } from 'react';

// Creating the Favorites Context
const FavoritesContext = createContext();

// Provider component that wraps your application and provides the Favorites state
export const FavoritesProvider = ({ children }) => {
    const [favorites, setFavorites] = useState(() => {
        // Initialize state from local storage, fallback to default if nothing in storage
        const localData = localStorage.getItem('favorites');
        return localData ? JSON.parse(localData) : { Fauna: [], Flora: [], Tank: [] };
    });

    // Use effect to update local storage when favorites change
    useEffect(() => {
        localStorage.setItem('favorites', JSON.stringify(favorites));
    }, [favorites]);

    const addFavorite = (category, item) => {
        setFavorites(prevFavorites => ({
            ...prevFavorites,
            [category]: [...prevFavorites[category], item]
        }));
    };

    const removeFavorite = (category, id) => {
        setFavorites(prevFavorites => ({
            ...prevFavorites,
            [category]: prevFavorites[category].filter(fav => fav.id !== id)
        }));
    };

    const favoriteSwitch = (category, item) => {
        let itemIndex;
        setFavorites(prevFavorites => {
            itemIndex = prevFavorites[category].findIndex(fav => fav.id === item.id);
            if (itemIndex !== -1) {
                // If item exists, remove it
                return {
                    ...prevFavorites,
                    [category]: prevFavorites[category].filter((fav, index) => index !== itemIndex)
                };
            } else {
                // If item does not exist, add it
                return {
                    ...prevFavorites,
                    [category]: [...prevFavorites[category], item]
                };
            }
        });
        // Return true if the item is added, false if removed
        return itemIndex === -1;
    };

    const isFavorite = (category, id) => {
        return favorites[category].some(fav => fav.id === id);
    };

    return (
        <FavoritesContext.Provider value={{ favorites, addFavorite, removeFavorite, favoriteSwitch, isFavorite }}>
            {children}
        </FavoritesContext.Provider>
    );
}

// Custom hook to use the favorites context
export const useFavorites = () => useContext(FavoritesContext);
