import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from 'antd';
import { MenuOutlined, CloseOutlined } from '@ant-design/icons';
import { Link, useLocation } from 'react-router-dom';

interface NavbarProps {
  isOpen: boolean;
  toggleSidebar: () => void;
}

const Navbar: React.FC<NavbarProps> = ({ isOpen, toggleSidebar }) => {
  const location = useLocation(); // Get current route
  const sidebarVariants = {
    open: {
      x: 0,
      transition: {
        duration: 0.4,
        ease: [0.4, 0, 0.2, 1],
        when: 'beforeChildren',
        staggerChildren: 0.1,
      },
    },
    closed: {
      x: '-100%',
      transition: {
        duration: 0.4,
        ease: [0.4, 0, 0.2, 1],
        when: 'afterChildren',
      },
    },
  };

  const navItemVariants = {
    open: { x: 0, opacity: 1, transition: { type: 'spring', stiffness: 400, damping: 20 } },
    closed: { x: -20, opacity: 0, transition: { duration: 0.2 } },
  };

  // Function to check if the link is active
  const isActive = (path: string) => location.pathname === path;

  return (
    <>
      <motion.div
        className="mobile-toggle"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        transition={{ type: 'spring', stiffness: 400, damping: 10 }}
      >
        <Button
          type="text"
          icon={<MenuOutlined />}
          onClick={toggleSidebar}
          className="toggle-sidebar"
          style={{ color: '#374151' }}
        />
      </motion.div>
      <AnimatePresence>
        {isOpen && (
          <motion.aside
            className="sidebar"
            variants={sidebarVariants}
            initial="closed"
            animate="open"
            exit="closed"
          >
            <motion.div
              className="toggle-container"
              transition={{ type: 'spring', stiffness: 400, damping: 10 }}
            >
              <Button
                type="text"
                icon={<CloseOutlined />}
                onClick={toggleSidebar}
                className="toggle-sidebar"
                style={{ color: '#ffffff' }}
              />
            </motion.div>
            <motion.div className="logo" variants={navItemVariants}>
              <span className="snowflake-icon">❄️</span>
              <h1>Ice Factory</h1>
            </motion.div>
            <nav>
              <Link to="/">
                <motion.button
                  className={`nav-button ${isActive('/') ? 'active' : ''}`}
                  variants={navItemVariants}
                  whileHover={{ x: 10, scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 10 }}
                >
                    Home
                </motion.button>
              </Link>
              <Link to='/dashboard'>  
                <motion.button
                  className={`nav-button ${isActive('/dashboard') ? 'active' : ''}`}
                  variants={navItemVariants}
                  whileHover={{ x: 10, scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 10 }}
                >
                    Dashboard
                </motion.button>
              </Link>  
              <Link to="/addsales">
                <motion.button
                  className={`nav-button ${isActive('/addsales') ? 'active' : ''}`}
                  variants={navItemVariants}
                  whileHover={{ x: 10, scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 10 }}
                >
                    Add Sales 
                </motion.button>
              </Link>
              <motion.button
                className={`nav-button ${isActive('/settings') ? 'active' : ''}`}
                variants={navItemVariants}
                whileHover={{ x: 10, scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                transition={{ type: 'spring', stiffness: 400, damping: 10 }}
              >
                Settings
              </motion.button>
            </nav>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
};

export default Navbar;
