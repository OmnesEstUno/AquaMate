import { Link } from "react-router-dom";
import React from "react";
import { useSearch } from './search/search_provider';
import logo from './images/AquaMate_logo.png';

const AMHeader = () => {
    const { searchTerm, setSearchTerm } = useSearch();

    const handleInputChange = (event) => {
        setSearchTerm(event.target.value); // Use setSearchTerm directly from the context
    };

    return (
        <header className={'header'} id={'header'}>
            <div className={'header-top'}>
                <div className={'header-right'} id={'header-right'}>
                    <img className={'logo'} src={logo} alt="AquaMate logo"/>
                    <div className={'title-wrapper'} id={'title-wrapper'}>
                        <a className={"title-A"} id={'title-A'} href={"/"}>a</a>
                        <a className={"title-l"} id={'title-l'} href={"/"}>qua</a>
                        <a className={"title-r"} id={'title-r'} href={"/"}>Mate</a>
                    </div>
                    <nav>
                        <ul>
                            <li><Link to="/buildertool">Plan</Link></li>
                            <li><Link to="#" className={'Aquascape'}></Link></li>
                            <li>
                                <input
                                    type="text"
                                    id="search-input"
                                    className="search-bar"
                                    value={searchTerm}
                                    onChange={handleInputChange}
                                    placeholder="Search..."
                                />
                            </li>
                            <li><Link to="/aboutus">Who Are We?</Link></li>
                            <li><Link to="#" className={'Sign in'}></Link></li>
                        </ul>
                    </nav>
                </div>
            </div>
            <svg className="waves" xmlns="http://www.w3.org/2000/svg"
                 viewBox="0 24 150 28" preserveAspectRatio="none" shapeRendering="auto">
                <defs>
                    <path id="gentle-wave"
                          d="M-160 44c30 0 58-18 88-18s 58 18 88 18 58-18 88-18 58 18 88 18 v44h-352z"/>
                </defs>
                <g className="parallax">
                    <use xlinkHref="#gentle-wave" x="48" y="0" fill="rgba(9, 73, 93,0.165" filter='blur(0.25px)'/>
                    <use xlinkHref="#gentle-wave" x="48" y="3" fill="rgba(9, 73, 93,0.1475)" filter='blur(0.25px)'/>
                    <use xlinkHref="#gentle-wave" x="48" y="5" fill="rgba(9, 73, 93,0.0625)" filter='blur(0.25px)'/>
                    <use xlinkHref="#gentle-wave" x="48" y="7" fill="rgba(9, 73, 93,0.25)" filter='blur(0.25px)'/>
                </g>
            </svg>
        </header>
    );
};

export default AMHeader;