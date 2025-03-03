import React from 'react';
import './builder_tool.css';

const BuildSection = ({ selectedFish, handleFishRemoval, selectedPlant, handlePlantRemoval, selectedTank, handleTankRemoval, setSelectedFish, setSelectedPlant, setSelectedTank }) => {
  // Function to update the amount of a specific fish by ID
    const updateFishAmount = (fishId, newAmount) => {
        setSelectedFish(prevFishes => 
        prevFishes.map(fish => fish.id === fishId ? { ...fish, amount: newAmount } : fish)
        );
    };
    
    // Function to update the amount of a specific plant by ID
    const updatePlantAmount = (plantId, newAmount) => {
        setSelectedPlant(prevPlants => 
        prevPlants.map(plant => plant.id === plantId ? { ...plant, amount: newAmount } : plant)
        );
    };
    
    return (
        <div className="build-container">
           <div className="build-title">Selected Fish</div>
            <div className="build-section">
                {selectedFish.map(fish => (
                    <div className="build-item" key={fish.id}>
                        <img src={fish.photo} alt={fish.commonName} />
                        <div className="build-description">{fish.commonName}</div>
                        <div className="fish-amount">
                            Quantity: {fish.amount}
                            <button onClick={(e) => {
                                e.stopPropagation(); // Prevents the click from triggering fish removal
                                updateFishAmount(fish.id, fish.amount + 1);
                            }}>+</button>
                            <button onClick={(e) => {
                                e.stopPropagation(); // Same as above
                                updateFishAmount(fish.id, fish.amount - 1);
                            }} disabled={fish.amount <= 1}>-</button>
                            <button onClick={(e) => {
                                e.stopPropagation(); // Stops click from bubbling up
                                handleFishRemoval(fish.id);
                            }} className="remove-fish-btn">Remove</button>
                        </div>
                    </div>
                ))}
            </div>


            <div className="build-title">Selected Plants</div>
            <div className="build-section">
                {selectedPlant.map(plant => (
                    <div className="build-item" key={plant.id}>
                        <img src={plant.photo} alt={plant.commonName} />
                        <div className="build-description">{plant.commonName}</div>
                        <div className="plant-amount">
                            Quantity: {plant.amount}
                            <button onClick={(e) => {
                                e.stopPropagation();
                                updatePlantAmount(plant.id, plant.amount + 1);
                            }}>+</button>
                            <button onClick={(e) => {
                                e.stopPropagation();
                                updatePlantAmount(plant.id, plant.amount - 1);
                            }} disabled={plant.amount <= 1}>-</button>
                            <button onClick={(e) => {
                                e.stopPropagation();
                                handlePlantRemoval(plant.id);
                            }} className="remove-plant-btn">Remove</button>
                        </div>
                    </div>
                ))}
            </div>




            <div className="build-title">Selected Tank</div>
            <div className="build-section">
                {selectedTank && (
                    <div className="build-item" onClick={() => handleTankRemoval(selectedTank.id)}>
                        <img src={selectedTank.photo} alt={`Tank: ${selectedTank.size}`} />
                        <div className="build-description">Size: {selectedTank.size}</div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default BuildSection;
