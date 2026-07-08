import React from "react";
import { Link } from "react-router-dom";
import './styles/footer.css';

const AMFooter = () => {
    return (
        <footer>
            <p style={{fontSize: '0.75em'}}>&copy; 2024 TeamTetra. All rights reserved.</p>
            <Link to="/aboutus" className="footer-about">About</Link>
        </footer>
    )
};

export default AMFooter;
