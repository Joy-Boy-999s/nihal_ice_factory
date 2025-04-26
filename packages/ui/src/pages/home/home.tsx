import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Table, Modal, Form, Input, InputNumber, DatePicker, Button, Space, Select, Menu, Dropdown } from 'antd';
import { DeleteOutlined, EditOutlined, PrinterOutlined, MenuOutlined, CloseOutlined, LogoutOutlined } from '@ant-design/icons';
import moment from 'moment';
import * as XLSX from 'xlsx';
import './home.css';
import Cookies from 'js-cookie';
import type { ColumnsType } from 'antd/es/table';
import Navbar from '../navbar/navbar';
import { useNavigate } from 'react-router';

// Define allowed unit values
type Unit = 'Unit 1' | 'Unit 2' | 'Unit 3';

interface Sale {
  id: number;
  unit: Unit;
  date: string;
  time: string;
  name: string;
  mobile: string;
  shop: string;
  cans: number;
  blocks: number;
  pieces: number;
  discount: number;
  totalAmount: number;
  soldBy: string;
}

// Home Component
const Home: React.FC = () => {
  const [sales, setSales] = useState<Sale[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [currentSale, setCurrentSale] = useState<Sale | null>(null);
  const [form] = Form.useForm();
  const printRef = useRef<HTMLDivElement>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [role,setRole]=useState<any>('USER')
  const navigate = useNavigate();


  useEffect ( ()=>{
    const jsrole = Cookies.get('userRole')?.toUpperCase();
    setRole(jsrole)
  })

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  const calculateTotal = (cans: number, blocks: number, pieces: number, discount: number = 0) => {
    const pricePerCan = 240;
    const pricePerBlock = 80;
    const pricePerPiece = 20;
    const subtotal = cans * pricePerCan + blocks * pricePerBlock + pieces * pricePerPiece;
    return subtotal - discount;
  };

  const calculateTotalCans = (cans: number, blocks: number, pieces: number) => {
    return cans + (blocks / 3) + (pieces / 12);
  };

  const handleAdd = () => {
    setCurrentSale(null);
    form.resetFields();
    form.setFieldsValue({
      time: moment(),
      date: moment(),
      discount: 0,
    });
    setModalVisible(true);
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

  const handleEdit = (sale: Sale) => {
    setCurrentSale(sale);
    form.setFieldsValue({
      ...sale,
      date: moment(sale.date, 'YYYY-MM-DD'),
      time: moment(sale.time, 'HH:mm'),
      unit: sale.unit,
    });
    setModalVisible(true);
  };

  const handleDelete = (id: number) => {
    Modal.confirm({
      title: 'Are you sure you want to delete this sale?',
      onOk: () => {
        setSales(sales.filter(sale => sale.id !== id));
      },
    });
  };

  const handleBulkDelete = () => {
    Modal.confirm({
      title: `Are you sure you want to delete ${selectedRowKeys.length} selected sales?`,
      onOk: () => {
        setSales(sales.filter(sale => !selectedRowKeys.includes(sale.id)));
        setSelectedRowKeys([]);
      },
    });
  };

  const handleSubmit = () => {
    form.validateFields().then(values => {
      const newSale = {
        ...values,
        date: values.date.format('YYYY-MM-DD'),
        time: values.time.format('HH:mm'),
        totalAmount: calculateTotal(values.cans, values.blocks, values.pieces, values.discount),
      };
      if (currentSale) {
        setSales(sales.map(sale => (sale.id === currentSale.id ? { ...sale, ...newSale } : sale)));
      } else {
        newSale.id = sales.length + 1;
        setSales([...sales, newSale]);
      }
      setModalVisible(false);
    });
  };

  const generatePrintContent = (records: Sale[]) => {
    return `
      <html>
        <head>
          <title>Sales Receipts</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            .bill-content { max-width: 600px; margin: 20px auto; border: 1px solid #ddd; padding: 20px; page-break-after: always; }
            .bill-content:last-child { page-break-after: auto; }
            h2 { text-align: center; }
            .bill-details { margin-top: 20px; }
            .bill-details p { margin: 5px 0; }
            .items { margin: 20px 0; }
            .items ul { list-style: none; padding: 0; }
            .items li { margin: 5px 0; }
            .total { font-weight: bold; }
            @media print {
              .bill-content { margin: 0 auto; }
            }
          </style>
        </head>
        <body>
          ${records.map(record => `
            <div class="bill-content">
              <h2>KP Ice Factory - Sales Receipt</h2>
              <div class="bill-details">
                <p><strong>Serial No:</strong> ${record.id}</p>
                <p><strong>Date:</strong> ${record.date}</p>
                <p><strong>Time:</strong> ${record.time}</p>
                <p><strong>Unit:</strong> ${record.unit}</p>
                <p><strong>Customer Name:</strong> ${record.name}</p>
                <p><strong>Mobile:</strong> ${record.mobile}</p>
                <p><strong>Shop Name:</strong> ${record.shop}</p>
              </div>
              <div class="items">
                <h3>Items Sold:</h3>
                <ul>
                  <li>Cans: ${record.cans} @ 240 Rs = ${record.cans * 240} Rs</li>
                  <li>Blocks: ${record.blocks} @ 80 Rs = ${record.blocks * 80} Rs</li>
                  <li>Pieces: ${record.pieces} @ 20 Rs = ${record.pieces * 20} Rs</li>
                  <li>Discount: ${record.discount} Rs</li>
                </ul>
              </div>
              <p class="total"><strong>Total Cans:</strong> ${calculateTotalCans(record.cans, record.blocks, record.pieces).toFixed(2)}</p>
              <p class="total"><strong>Total Amount:</strong> ${record.totalAmount} Rs</p>
              <p><strong>Sold By:</strong> ${record.soldBy}</p>
            </div>
          `).join('')}
        </body>
      </html>
    `;
  };

  const handlePrint = (record: Sale) => {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(generatePrintContent([record]));
      printWindow.document.close();
      printWindow.print();
    }
  };

  const handleBulkPrint = () => {
    const selectedRecords = sales.filter(sale => selectedRowKeys.includes(sale.id));
    if (selectedRecords.length === 0) {
      Modal.warning({
        title: 'No records selected',
        content: 'Please select at least one sale to print.',
      });
      return;
    }
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(generatePrintContent(selectedRecords));
      printWindow.document.close();
      printWindow.print();
    }
  };

  const handleExportExcel = () => {
    const exportData = sales.map(sale => ({
      'Serial No': sale.id,
      Date: sale.date,
      Time: sale.time,
      Unit: sale.unit,
      Name: sale.name,
      Mobile: sale.mobile,
      'Customer Shop Name': sale.shop,
      Cans: sale.cans,
      Blocks: sale.blocks,
      Pieces: sale.pieces,
      Discount: sale.discount,
      'Total Cans': calculateTotalCans(sale.cans, sale.blocks, sale.pieces).toFixed(2),
      'Total Amount': sale.totalAmount,
      'Sold By': sale.soldBy,
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sales');
    XLSX.writeFile(wb, 'sales_data.xlsx');
  };

  const salesWithTotalCans = sales.map(sale => ({
    ...sale,
    totalCans: calculateTotalCans(sale.cans, sale.blocks, sale.pieces),
  }));

  const columns: ColumnsType<Sale & { totalCans: number }> = [
    { title: 'Serial No', dataIndex: 'id', key: 'id', width: '8%', align: 'center' },
    { title: 'Date', dataIndex: 'date', key: 'date', width: '10%', align: 'center' },
    { title: 'Time', dataIndex: 'time', key: 'time', width: '8%', align: 'center' },
    { 
      title: 'Unit', 
      dataIndex: 'unit', 
      key: 'unit', 
      width: '12%', 
      align: 'center',
      render: (unit: Unit) => unit
    },
    { title: 'Name', dataIndex: 'name', key: 'name', width: '15%', align: 'center' },
    { title: 'Mobile', dataIndex: 'mobile', key: 'mobile', width: '12%', align: 'center' },
    { title: 'Customer Shop Name', dataIndex: 'shop', key: 'shop', width: '15%', align: 'center' },
    {
      title: 'Items Sold',
      key: 'itemsSold',
      children: [
        { title: 'Cans', dataIndex: 'cans', key: 'cans', width: '8%', align: 'center' },
        { title: 'Blocks', dataIndex: 'blocks', key: 'blocks', width: '8%', align: 'center' },
        { title: 'Pieces', dataIndex: 'pieces', key: 'pieces', width: '8%', align: 'center' },
      ],
    },
    {
      title: 'Total Cans',
      dataIndex: 'totalCans',
      key: 'totalCans',
      width: '8%',
      align: 'center',
      render: (value: number) => value.toFixed(2),
    },
    { title: 'Discount', dataIndex: 'discount', key: 'discount', width: '8%', align: 'center' },
    { title: 'Total Amount', dataIndex: 'totalAmount', key: 'totalAmount', width: '12%', align: 'center' },
    { title: 'Sold By', dataIndex: 'soldBy', key: 'soldBy', width: '12%', align: 'center' },
    {
      title: 'Actions',
      key: 'actions',
      width: '10%',
      align: 'center',
      render: (_: any, record: Sale) => (
        <Space>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
            className="edit-btn"
          />
          <Button
            type="link"
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record.id)}
            className="delete-btn"
          />
          <Button
            type="link"
            icon={<PrinterOutlined />}
            onClick={() => handlePrint(record)}
            className="print-btn"
          />
        </Space>
      ),
    },
  ];

  const rowSelection = {
    selectedRowKeys,
    onChange: (selectedKeys: React.Key[]) => {
      setSelectedRowKeys(selectedKeys);
    },
  };

  const containerVariants = {
    hidden: { opacity: 0, scale: 0.95 },
    visible: { opacity: 1, scale: 1, transition: { staggerChildren: 0.2, ease: 'easeOut', duration: 0.6 } },
  };

  const itemVariants = {
    hidden: { y: 30, opacity: 0, scale: 0.9 },
    visible: { y: 0, opacity: 1, scale: 1, transition: { duration: 0.6, ease: [0.6, -0.05, 0.01, 0.99] } },
  };

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
            <h2>Sales Management - KP Ice Factory</h2>
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
          <motion.div className="button-container" variants={itemVariants}>
            <motion.button
              className="action-button add-sale"
              onClick={handleAdd}
              whileHover={{ scale: 1.05, boxShadow: '0 8px 20px rgba(0, 0, 0, 0.2)' }}
              whileTap={{ scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 300, damping: 15 }}
            >
              Add Sale
            </motion.button>
            <motion.button
              className="action-button export-excel"
              onClick={handleExportExcel}
              whileHover={{ scale: 1.05, boxShadow: '0 8px 20px rgba(0, 0, 0, 0.2)' }}
              whileTap={{ scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 300, damping: 15 }}
            >
              Export to Excel
            </motion.button>
            {selectedRowKeys.length > 0 && (
              <>
                <motion.button
                  className="action-button delete-selected"
                  onClick={handleBulkDelete}
                  whileHover={{ scale: 1.05, boxShadow: '0 8px 20px rgba(0, 0, 0, 0.2)' }}
                  whileTap={{ scale: 0.95 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 15 }}
                  style={{ background: '#ff4d4f', color: '#fff', marginLeft: '10px' }}
                >
                  Delete Selected ({selectedRowKeys.length})
                </motion.button>
                <motion.button
                  className="action-button print-selected"
                  onClick={handleBulkPrint}
                  whileHover={{ scale: 1.05, boxShadow: '0 8px 20px rgba(0, 0, 0, 0.2)' }}
                  whileTap={{ scale: 0.95 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 15 }}
                  style={{ background: '#1890ff', color: '#fff', marginLeft: '10px' }}
                >
                  Print Selected ({selectedRowKeys.length})
                </motion.button>
              </>
            )}
          </motion.div>
          <motion.div className="card table-card" variants={itemVariants}>
            <h3>Sales Records</h3>
            <Table
              dataSource={salesWithTotalCans}
              columns={columns}
              rowKey="id"
              className="sales-table"
              scroll={{ x: 'max-content' }}
              pagination={{ pageSize: 10, showSizeChanger: false }}
              rowSelection={rowSelection}
            />
          </motion.div>
        </motion.div>
      </div>
      <Modal
        title={currentSale ? 'Edit Sale' : 'Add Sale'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        width="90%"
        style={{ maxWidth: '720px', margin: '24px auto' }}
        className="sales-modal"
        bodyStyle={{ 
          backgroundColor: '#ffffff', 
          padding: '32px', 
          borderRadius: '12px',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.15)'
        }}
        okButtonProps={{ className: 'modal-ok-btn' }}
        cancelButtonProps={{ className: 'modal-cancel-btn' }}
        footer={[
          <Button 
            key="cancel" 
            className="modal-cancel-btn" 
            onClick={() => setModalVisible(false)}
            style={{
              borderRadius: '8px',
              padding: '8px 20px',
              fontWeight: 500,
              borderColor: '#d1d5db',
              color: '#4b5563',
              background: '#ffffff'
            }}
          >
            Cancel
          </Button>,
          <Button 
            key="submit" 
            type="primary" 
            className="modal-ok-btn" 
            onClick={handleSubmit}
            style={{
              borderRadius: '8px',
              padding: '8px 20px',
              fontWeight: 500,
              background: '#2563eb',
              borderColor: '#2563eb',
              color: '#ffffff'
            }}
          >
            {currentSale ? 'Update' : 'Add'}
          </Button>,
        ]}
      >
        <Form 
          form={form} 
          layout="vertical" 
          className="sales-form"
        >
          <div className="space-y-8">
            {/* Section 1: Date and Time (Disabled) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Form.Item
                name="date"
                label="Date"
                rules={[{ required: true, message: 'Date is required' }]}
                className="form-item"
              >
                <DatePicker 
                  format="YYYY-MM-DD" 
                  className="w-full" 
                  disabled
                  style={{
                    borderRadius: '8px',
                    border: '1px solid #d1d5db',
                    background: '#f0f2f5',
                    color: '#4b5563'
                  }}
                />
              </Form.Item>
              <Form.Item
                name="time"
                label="Time"
                rules={[{ required: true, message: 'Time is required' }]}
                className="form-item"
              >
                <DatePicker.TimePicker 
                  format="HH:mm" 
                  className="w-full" 
                  disabled
                  style={{
                    borderRadius: '8px',
                    border: '1px solid #d1d5db',
                    background: '#f0f2f5',
                    color: '#4b5563'
                  }}
                />
              </Form.Item>
            </div>

            {/* Section 2: Customer Information */}
            <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4" style={{ color: '#1f2937' }}>
                Customer Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Form.Item
                  name="name"
                  label="Name"
                  rules={[{ required: true, message: 'Please enter a name' }]}
                  className="form-item"
                >
                  <Input 
                    className="w-full" 
                    style={{
                      borderRadius: '8px',
                      border: '1px solid #d1d5db',
                      padding: '10px',
                      transition: 'border-color 0.2s ease, box-shadow 0.2s ease'
                    }}
                  />
                </Form.Item>
                <Form.Item
                  name="mobile"
                  label="Mobile"
                  rules={[
                    { required: true, message: 'Please enter a mobile number' },
                    {
                      pattern: /^[6-9]\d{9}$/,
                      message: 'Please enter a valid 10-digit Indian mobile number'
                    }
                  ]}
                  className="form-item"
                >
                  <Input 
                    className="w-full" 
                    style={{
                      borderRadius: '8px',
                      border: '1px solid #d1d5db',
                      padding: '10px'
                    }}
                  />
                </Form.Item>
                <Form.Item
                  name="shop"
                  label="Shop"
                  rules={[{ required: true, message: 'Please enter a shop name' }]}
                  className="form-item"
                >
                  <Input 
                    className="w-full" 
                    style={{
                      borderRadius: '8px',
                      border: '1px solid #d1d5db',
                      padding: '10px'
                    }}
                  />
                </Form.Item>
              </div>
            </div>

            {/* Section 3: Sale Details */}
            <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4" style={{ color: '#1f2937' }}>
                Sale Details
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Form.Item
                  name="unit"
                  label="Unit"
                  rules={[{ required: true, message: 'Please select a unit' }]}
                  className="form-item"
                >
                  <Select 
                    allowClear 
                    className="w-full"
                    style={{
                      borderRadius: '8px'
                    }}
                  >
                    <Select.Option value="Unit 1">Unit 1</Select.Option>
                    <Select.Option value="Unit 2">Unit 2</Select.Option>
                    <Select.Option value="Unit 3">Unit 3</Select.Option>
                  </Select>
                </Form.Item>
                <Form.Item
                  name="cans"
                  label="Cans"
                  rules={[{ required: true, message: 'Please enter number of cans' }]}
                  className="form-item"
                >
                  <InputNumber 
                    min={0} 
                    className="w-full" 
                    style={{
                      borderRadius: '8px',
                      border: '1px solid #d1d5db'
                    }}
                  />
                </Form.Item>
                <Form.Item
                  name="blocks"
                  label="Blocks"
                  rules={[{ required: true, message: 'Please enter number of blocks' }]}
                  className="form-item"
                >
                  <InputNumber 
                    min={0} 
                    className="w-full" 
                    style={{
                      borderRadius: '8px',
                      border: '1px solid #d1d5db'
                    }}
                  />
                </Form.Item>
                <Form.Item
                  name="pieces"
                  label="Pieces"
                  rules={[{ required: true, message: 'Please enter number of pieces' }]}
                  className="form-item"
                >
                  <InputNumber 
                    min={0} 
                    className="w-full" 
                    style={{
                      borderRadius: '8px',
                      border: '1px solid #d1d5db'
                    }}
                  />
                </Form.Item>
                <Form.Item
                  name="discount"
                  label="Discount"
                  rules={[{ required: true, message: 'Please enter discount amount' }]}
                  className="form-item"
                >
                  <InputNumber 
                    min={0} 
                    className="w-full" 
                    style={{
                      borderRadius: '8px',
                      border: '1px solid #d1d5db'
                    }}
                  />
                </Form.Item>
                <Form.Item 
                  label="Total Cans" 
                  shouldUpdate 
                  className="form-item"
                >
                  {() => (
                    <span 
                      className="text-base font-medium"
                      style={{ color: '#10b981' }}
                    >
                      {calculateTotalCans(
                        form.getFieldValue('cans') || 0,
                        form.getFieldValue('blocks') || 0,
                        form.getFieldValue('pieces') || 0
                      ).toFixed(2)}
                    </span>
                  )}
                </Form.Item>
                <Form.Item 
                  label="Total Amount" 
                  shouldUpdate 
                  className="form-item"
                >
                  {() => (
                    <span 
                      className="text-base font-medium"
                      style={{ color: '#2563eb' }}
                    >
                      {calculateTotal(
                        form.getFieldValue('cans') || 0,
                        form.getFieldValue('blocks') || 0,
                        form.getFieldValue('pieces') || 0,
                        form.getFieldValue('discount') || 0
                      )} Rs
                    </span>
                  )}
                </Form.Item>
              </div>
            </div>

            {/* Section 4: Sold By */}
            <Form.Item
              name="soldBy"
              label="Sold By"
              rules={[{ required: true, message: 'Please enter sold by' }]}
              className="form-item"
            >
              <Input 
                className="w-full" 
                style={{
                  borderRadius: '8px',
                  border: '1px solid #d1d5db',
                  padding: '10px'
                }}
              />
            </Form.Item>
          </div>
        </Form>
      </Modal>
    </div>
  );
};

export default Home;