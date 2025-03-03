import React from 'react';
import { useFavorites } from './favorites_provider';

function Favorites() {
    const { favorites, removeFavorite } = useFavorites();

    return (
        <div className="favorites-container">
            <h2>Favorites</h2>
           {/* Fish Section */}
            <section className="favorites-section">
                <h3>Fish</h3>
                <div className="card-container">
                    {favorites.Fauna?.map(fish => (
                        <div key={fish.id} className='card'>
                            <img className="card-image" src={fish.photo} alt={fish.commonName} />
                            <p>{fish.commonName}</p>
                            <button onClick={(e) => {
                                e.stopPropagation(); 
                                removeFavorite('Fauna', fish.id);
                            }}>Remove</button>
                        </div>
                    ))}
                </div>
            </section>

            {/* Plants Section */}
            <section className="favorites-section">
                <h3>Plants</h3>
                <div className="card-container">
                    {favorites.Flora?.map(plant => (
                        <div key={plant.id} className='card'>
                            <img className="card-image" src={plant.photo} alt={plant.commonName} />
                            <p>{plant.commonName}</p>
                            <button onClick={(e) => {
                                e.stopPropagation();
                                removeFavorite('Flora', plant.id);
                            }}>Remove</button>
                        </div>
                    ))}
                </div>
            </section>

            {/* Tanks Section */}
            <section className="favorites-section">
                <h3>Tanks</h3>
                <div className="card-container">
                    {favorites.Tank?.map(tank => (
                        <div key={tank.id} className='card'>
                            <img className="card-image" src={tank.photo} alt={tank.name} />
                            <p>{tank.size}</p>
                            <button onClick={(e) => {
                                e.stopPropagation(); 
                                removeFavorite('Tank', tank.id);
                            }}>Remove</button>
                        </div>
                    ))}
                </div>
            </section>

        </div>
    );
}

export default Favorites;
