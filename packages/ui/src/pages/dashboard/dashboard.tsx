import React, { useEffect, useState } from 'react';
import './dashboard.css';
import { motion } from 'framer-motion';
import { Bar, Line } from 'react-chartjs-2';
import Cookies from 'js-cookie';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import Navbar from '../navbar/navbar';
import { Dropdown, Menu } from 'antd';
import menu from 'antd/es/menu';
import { useNavigate } from 'react-router-dom';
import { LogoutOutlined } from '@ant-design/icons'; 


ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend
);

const Dashboard: React.FC = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [role,setRole]=useState<any>('USER')
  const navigate = useNavigate();


  useEffect ( ()=>{
    const jsrole = Cookies.get('userRole')?.toUpperCase();
    setRole(jsrole)
  })

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  const thisMonthSalesData = {
    labels: ['Apr 1', 'Apr 5', 'Apr 10', 'Apr 15', 'Apr 20', 'Apr 23'],
    datasets: [
      {
        label: 'Sales ($)',
        data: [200, 350, 400, 300, 500, 250],
        backgroundColor: 'rgba(59, 130, 246, 0.6)',
        borderColor: 'rgba(59, 130, 246, 1)',
        borderWidth: 1,
      },
    ],
  };

  const thisYearSalesData = {
    labels: ['Jan', 'Feb', 'Mar', 'Apr'],
    datasets: [
      {
        label: 'Sales ($)',
        data: [5000, 6000, 7000, 7900],
        fill: false,
        borderColor: 'rgba(16, 185, 129, 1)',
        tension: 0.3,
      },
    ],
  };

  const thisWeekSalesData = {
    labels: ['Apr 17', 'Apr 18', 'Apr 19', 'Apr 20', 'Apr 21', 'Apr 22', 'Apr 23'],
    datasets: [
      {
        label: 'Sales ($)',
        data: [100, 150, 200, 500, 300, 400, 250],
        backgroundColor: 'rgba(236, 72, 153, 0.6)',
        borderColor: 'rgba(236, 72, 153, 1)',
        borderWidth: 1,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          font: { size: 12 },
          color: '#374151',
        },
      },
      tooltip: {
        backgroundColor: '#1f2937',
        titleFont: { size: 14 },
        bodyFont: { size: 12 },
      },
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: '#374151' } },
      y: { grid: { color: '#e5e7eb' }, ticks: { color: '#374151' } },
    },
  };

  const containerVariants = {
    hidden: { opacity: 0, scale: 0.95 },
    visible: {
      opacity: 1,
      scale: 1,
      transition: {
        staggerChildren: 0.2,
        ease: 'easeOut',
        duration: 0.6,
      },
    },
  };

  const itemVariants = {
    hidden: { y: 30, opacity: 0, scale: 0.9 },
    visible: {
      y: 0,
      opacity: 1,
      scale: 1,
      transition: { duration: 0.6, ease: [0.6, -0.05, 0.01, 0.99] },
    },
  };

  const handleLogout = () => {
    Cookies.remove('accessToken');
    Cookies.remove('userRole');
    navigate('/login');
  };

  const menu = (
    <Menu>
      <Menu.Item key="logout" onClick={handleLogout} icon={<LogoutOutlined />}>
        Logout
      </Menu.Item>
    </Menu>
  );

  return (
    <div className="dashboard-container">
      <Navbar isOpen={isSidebarOpen} toggleSidebar={toggleSidebar} />
      <div className={`main-content ${isSidebarOpen ? 'sidebar-open' : ''}`}>
        <motion.header
          className="header"
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
        >
          <div className="header-left">
            <h2>Welcome to Ice Factory Dashboard</h2>
          </div>
          <Dropdown overlay={menu} placement="bottomCenter" trigger={['hover']}>
            <div className="user-info" style={{ display: "flex", alignItems: "center", cursor: "pointer" }}>
              <span className="user-icon">👤</span>
              <span>{role}</span>
            </div>
          </Dropdown>
        </motion.header>
        <motion.div
          className="content"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          <motion.div className="card" variants={itemVariants}>
            <h3>Current Inventory</h3>
            <p className="value">1,250 kg</p>
          </motion.div>
          <motion.div className="card" variants={itemVariants}>
            <h3>Sales Today</h3>
            <p className="value">$250</p>
          </motion.div>
          <motion.div className="card" variants={itemVariants}>
            <h3>Sales This Month</h3>
            <p className="value">$7,900</p>
          </motion.div>
          <motion.div className="chart-container" variants={itemVariants}>
            <div className="chart-card">
              <h3>This Month's Sales</h3>
              <div className="chart-wrapper">
                <Bar data={thisMonthSalesData} options={chartOptions} />
              </div>
            </div>
            <div className="chart-card">
              <h3>This Year's Sales</h3>
              <div className="chart-wrapper">
                <Line data={thisYearSalesData} options={chartOptions} />
              </div>
            </div>
            <div className="chart-card">
              Moulik's Sales
              <div className="chart-wrapper">
                <Bar data={thisWeekSalesData} options={chartOptions} />
              </div>
            </div>
          </motion.div>
          <motion.div className="button-container" variants={itemVariants}>
            <motion.button
              className="action-button production"
              whileHover={{ scale: 1.05, boxShadow: '0 8px 20px rgba(0, 0, 0, 0.2)' }}
              whileTap={{ scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 300, damping: 15 }}
            >
              Add Production
            </motion.button>
            <motion.button
              className="action-button sale"
              whileHover={{ scale: 1.05, boxShadow: '0 8px 20px rgba(0, 0, 0, 0.2)' }}
              whileTap={{ scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 300, damping: 15 }}
            >
              New Sale
            </motion.button>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
};

export default Dashboard;