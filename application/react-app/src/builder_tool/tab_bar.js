import React from 'react';
import './builder_tool.css';

const TabBar = ({ activeTab, openTab }) => {
  return (
    <div className="tab">
      <button className={`tablinks ${activeTab === 'Fish' ? 'active' : ''}`} onClick={() => openTab('Fish')}>
        Fish
      </button>
      <button className={`tablinks ${activeTab === 'Plants' ? 'active' : ''}`} onClick={() => openTab('Plants')}>
        Plants
      </button>
      <button className={`tablinks ${activeTab === 'Tanks' ? 'active' : ''}`} onClick={() => openTab('Tanks')}>
        Tanks
      </button>
      <button className={`tablinks ${activeTab === 'Favorites' ? 'active' : ''}`} onClick={() => openTab('Favorites')}>
        Favorites
      </button>
    </div>
  );
};

export default TabBar;
