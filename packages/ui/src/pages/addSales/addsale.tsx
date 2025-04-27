import React, { useState, useEffect, useCallback, useMemo, FC } from 'react';
import { motion } from 'framer-motion';
import { Form, Input, InputNumber, DatePicker, Button, Select, Menu, Dropdown, Modal } from 'antd';
import { LogoutOutlined } from '@ant-design/icons';
import moment from 'moment';
import Cookies from 'js-cookie';
import { useNavigate } from 'react-router-dom';
import Navbar from '../navbar/navbar';
import { SalesHelpService } from '@nihal-ice-factory/shared-services';

interface CreateSaleDto {
  date: string;
  time: string;
  unit: string;
  name: string;
  mobile: string;
  shop: string;
  cans: number;
  blocks: number;
  pieces: number;
  totalCans: number;
  discount?: number;
  totalAmount: number;
  soldBy: string;
}

const AddSale: FC = () => {
  const [form] = Form.useForm();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [role, setRole] = useState<string>('USER');
  const [loading, setLoading] = useState<boolean>(false);
  const navigate = useNavigate();
  const salesService = useMemo(() => new SalesHelpService(), []);

  useEffect(() => {
    const accessToken = Cookies.get('accessToken');
    if (!accessToken) {
      navigate('/login', { replace: true });
      return;
    }
    const jsrole = Cookies.get('userRole')?.toUpperCase();
    setRole(jsrole || 'USER');
    form.setFieldsValue({
      time: moment(),
      date: moment(),
      discount: 0,
    });
  }, [navigate, form]);

  const toggleSidebar = useCallback(() => {
    setIsSidebarOpen(prev => !prev);
  }, []);

  const calculateTotal = useCallback((cans: number, blocks: number, pieces: number, discount: number = 0) => {
    const pricePerCan = 240;
    const pricePerBlock = 80;
    const pricePerPiece = 20;
    const subtotal = cans * pricePerCan + blocks * pricePerBlock + pieces * pricePerPiece;
    return subtotal - discount;
  }, []);

  const calculateTotalCans = useCallback((cans: number, blocks: number, pieces: number) => {
    return cans + blocks / 3 + pieces / 12;
  }, []);

  const handleSubmit = useCallback(async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);
  
      const accessToken = Cookies.get('accessToken');
      if (!accessToken) throw new Error('No access token found');
  
      const config = {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      };
  
      const saleData: CreateSaleDto = {
        date: values.date.format('YYYY-MM-DD'),
        time: values.time.format('HH:mm'),
        unit: values.unit,
        name: values.name,
        mobile: values.mobile,
        shop: values.shop,
        cans: Number(values.cans),
        blocks: Number(values.blocks),
        pieces: Number(values.pieces),
        discount: Number(values.discount),
        totalAmount: calculateTotal(values.cans, values.blocks, values.pieces, values.discount),
        totalCans: calculateTotalCans(values.cans, values.blocks, values.pieces),
        soldBy: values.soldBy,
      };
  
      const response = await salesService.createSale(saleData, config);
  
      if (response.status) {
        Modal.success({
          title: 'Sale Created',
          content: response.internalMessage || 'Sale created successfully',
          // only reset once the user closes the modal
          onOk: () => form.resetFields(),
        });
      } else {
        throw new Error(response.internalMessage || `Unexpected response code: ${response.status}`);
      }
  
    } catch (error: any) {
      console.error('Error creating sale:', error);
      if (error.response?.status === 401) {
        Cookies.remove('accessToken');
        Cookies.remove('userRole');
        Modal.error({
          title: 'Session Expired',
          content: 'Your session has expired. Please log in again.',
          onOk: () => navigate('/login', { replace: true }),
        });
      } else {
        Modal.error({
          title: 'Error',
          content: error.message || 'An error occurred while creating the sale',
        });
      }
    } finally {
      setLoading(false);
    }
  }, [form, calculateTotal, calculateTotalCans, navigate, salesService]);
  

  const handleLogout = useCallback(() => {
    Cookies.remove('accessToken');
    Cookies.remove('userRole');
    navigate('/login');
  }, [navigate]);

  const menu = useMemo(() => (
    <Menu>
      <Menu.Item key="logout" onClick={handleLogout} icon={<LogoutOutlined />}>
        Logout
      </Menu.Item>
    </Menu>
  ), [handleLogout]);

  const containerVariants = {
    hidden: { opacity: 0, scale: 0.95 },
    visible: { opacity: 1, scale: 1, transition: { staggerChildren: 0.2, ease: 'easeOut', duration: 0.6 } },
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
            <h3>Add New Sale - KP Ice Factory</h3>
          </div>
          <Dropdown overlay={menu} placement="bottomCenter" trigger={['hover']}>
            <div className="user-info" style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
              <span className="user-icon">👤</span>
              <span>{role}</span>
            </div>
          </Dropdown>
        </motion.header>
        <motion.div className="content" variants={containerVariants} initial="hidden" animate="visible">
          <div className="card table-card">
            <h3>Add Sale</h3>
            <Form form={form} layout="vertical" className="sales-form" onFinish={handleSubmit}>
              <div className="space-y-8">
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
                        color: '#4b5563',
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
                        color: '#4b5563',
                      }}
                    />
                  </Form.Item>
                </div>
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
                          transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
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
                          message: 'Please enter a valid 10-digit Indian mobile number',
                        },
                      ]}
                      className="form-item"
                    >
                      <Input
                        className="w-full"
                        style={{
                          borderRadius: '8px',
                          border: '1px solid #d1d5db',
                          padding: '10px',
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
                          padding: '10px',
                        }}
                      />
                    </Form.Item>
                  </div>
                </div>
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
                      <Select allowClear className="w-full" style={{ borderRadius: '8px' }}>
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
                      <InputNumber min={0} className="w-full" style={{ borderRadius: '8px', border: '1px solid #d1d5db' }} />
                    </Form.Item>
                    <Form.Item
                      name="blocks"
                      label="Blocks"
                      rules={[{ required: true, message: 'Please enter number of blocks' }]}
                      className="form-item"
                    >
                      <InputNumber min={0} className="w-full" style={{ borderRadius: '8px', border: '1px solid #d1d5db' }} />
                    </Form.Item>
                    <Form.Item
                      name="pieces"
                      label="Pieces"
                      rules={[{ required: true, message: 'Please enter number of pieces' }]}
                      className="form-item"
                    >
                      <InputNumber min={0} className="w-full" style={{ borderRadius: '8px', border: '1px solid #d1d5db' }} />
                    </Form.Item>
                    <Form.Item
                      name="discount"
                      label="Discount"
                      rules={[{ required: true, message: 'Please enter discount amount' }]}
                      className="form-item"
                    >
                      <InputNumber min={0} className="w-full" style={{ borderRadius: '8px', border: '1px solid #d1d5db' }} />
                    </Form.Item>
                    <Form.Item label="Total Cans" shouldUpdate className="form-item">
                      {() => (
                        <span className="text-base font-medium" style={{ color: '#10b981' }}>
                          {calculateTotalCans(
                            form.getFieldValue('cans') || 0,
                            form.getFieldValue('blocks') || 0,
                            form.getFieldValue('pieces') || 0
                          ).toFixed(2)}
                        </span>
                      )}
                    </Form.Item>
                    <Form.Item label="Total Amount" shouldUpdate className="form-item">
                      {() => (
                        <span className="text-base font-medium" style={{ color: '#2563eb' }}>
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
                <Form.Item
                  name="soldBy"
                  label="Sold By"
                  rules={[{ required: true, message: 'Please enter sold by' }]}
                  className="form-item"
                >
                  <Input
                    className="w-full"
                    style={{ borderRadius: '8px', border: '1px solid #d1d5db', padding: '10px' }}
                  />
                </Form.Item>
                <Form.Item>
                  <Button
                    className="modal-cancel-btn"
                    onClick={() => navigate('/sales')}
                    style={{
                      borderRadius: '8px',
                      padding: '8px 20px',
                      fontWeight: 500,
                      borderColor: '#d1d5db',
                      color: '#4b5563',
                      background: '#ffffff',
                      marginRight: '10px',
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="primary"
                    htmlType="submit"
                    loading={loading}
                    style={{
                      borderRadius: '8px',
                      padding: '8px 20px',
                      fontWeight: 500,
                      background: '#2563eb',
                      borderColor: '#2563eb',
                      color: '#ffffff',
                    }}
                  >
                    Add
                  </Button>
                </Form.Item>
              </div>
            </Form>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default React.memo(AddSale);