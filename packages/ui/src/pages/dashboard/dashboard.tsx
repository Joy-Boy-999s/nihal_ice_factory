import React from 'react';
import './dashboard.css';
import { motion } from 'framer-motion';
import { Bar, Line } from 'react-chartjs-2';
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

// Register Chart.js components
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
  // Sample data for charts
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

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2,
      },
    },
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1, transition: { duration: 0.5 } },
  };

  return (
    <div className="dashboard-container">
      <motion.aside
        className="sidebar"
        initial={{ x: -100, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.6 }}
      >
        <div className="logo">
          <span className="snowflake-icon">❄️</span>
          <h1>Ice Factory</h1>
        </div>
        <nav>
          <button className="nav-button active">Dashboard</button>
          {/* <button className="nav-button">Production</button> */}
          <button className="nav-button">Sales</button>
          {/* <button className="nav-button">Settings</button> */}
        </nav>
      </motion.aside>
      <div className="main-content">
        <motion.header
          className="header"
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          <h2>Welcome to Ice Factory Dashboard</h2>
          <div className="user-info">
            <span className="user-icon">👤</span>
            <span>Admin</span>
          </div>
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
              <h3>This Week's Sales</h3>
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
            >
              Add Production
            </motion.button>
            <motion.button
              className="action-button sale"
              whileHover={{ scale: 1.05, boxShadow: '0 8px 20px rgba(0, 0, 0, 0.2)' }}
              whileTap={{ scale: 0.95 }}
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