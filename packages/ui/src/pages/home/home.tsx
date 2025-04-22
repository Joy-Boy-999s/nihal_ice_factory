import React, { useState, useRef } from 'react';
import { Table, Modal, Form, Input, InputNumber, DatePicker, Button, Space, Select } from 'antd';
import { DeleteOutlined, EditOutlined, LogoutOutlined, PrinterOutlined } from '@ant-design/icons';
import moment from 'moment';
import './home.css';

// Define allowed unit values
type Unit = 'Unit 1' | 'Unit 2' | 'Unit 3';

interface Sale {
  id: number;
  unit: Unit;
  date: string;
  name: string;
  mobile: string;
  shop: string;
  cans: number;
  blocks: number;
  pieces: number;
  totalAmount: number;
  soldBy: string;
}

const Home: React.FC = () => {
  const [sales, setSales] = useState<Sale[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [currentSale, setCurrentSale] = useState<Sale | null>(null);
  const [form] = Form.useForm();
  const printRef = useRef<HTMLDivElement>(null);
  const [printData, setPrintData] = useState<Sale | null>(null);

  // Calculate total amount based on new prices
  const calculateTotal = (cans: number, blocks: number, pieces: number) => {
    const pricePerCan = 240; // 240 Rs per can
    const pricePerBlock = 80; // 80 Rs per block
    const pricePerPiece = 20; // 20 Rs per piece
    return cans * pricePerCan + blocks * pricePerBlock + pieces * pricePerPiece;
  };

  // Calculate total cans based on document relationships
  const calculateTotalCans = (cans: number, blocks: number, pieces: number) => {
    return cans + (blocks / 3) + (pieces / 12);
  };

  const handleAdd = () => {
    setCurrentSale(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (sale: Sale) => {
    setCurrentSale(sale);
    form.setFieldsValue({
      ...sale,
      date: moment(sale.date, 'YYYY-MM-DD'),
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

  const handleSubmit = () => {
    form.validateFields().then(values => {
      const newSale = {
        ...values,
        date: values.date.format('YYYY-MM-DD'),
        totalAmount: calculateTotal(values.cans, values.blocks, values.pieces),
      };
      if (currentSale) {
        setSales(sales.map(sale => (sale.id === currentSale.id ? { ...sale, ...newSale } : sale)));
      } else {
        newSale.id = sales.length + 1;
        setSales([...sales, newSale]);
      }
      // Set print data for the new/updated sale
      setPrintData(newSale);
      setModalVisible(false);
    });
  };

  const handlePrint = () => {
    form.validateFields().then(values => {
      const saleData = {
        ...values,
        date: values.date.format('YYYY-MM-DD'),
        totalAmount: calculateTotal(values.cans, values.blocks, values.pieces),
      };
      setPrintData(saleData);
      setTimeout(() => {
        window.print();
      }, 0);
    });
  };

  // Calculate total cans for display in table
  const salesWithTotalCans = sales.map(sale => ({
    ...sale,
    totalCans: calculateTotalCans(sale.cans, sale.blocks, sale.pieces),
  }));

  // Table columns
  const columns = [
    { title: 'Date', dataIndex: 'date', key: 'date', width: '10%', align: 'center' as const },
    { title: 'Unit', dataIndex: 'unit', key: 'unit', width: '10%', align: 'center' as const },
    { title: 'Name', dataIndex: 'name', key: 'name', width: '15%', align: 'center' as const },
    { title: 'Mobile', dataIndex: 'mobile', key: 'mobile', width: '12%', align: 'center' as const },
    { title: 'Customer Shop Name', dataIndex: 'shop', key: 'shop', width: '15%', align: 'center' as const },
    {
      title: 'Items Sold',
      key: 'itemsSold',
      children: [
        { title: 'Cans', dataIndex: 'cans', key: 'cans', width: '8%', align: 'center' as const },
        { title: 'Blocks', dataIndex: 'blocks', key: 'blocks', width: '8%', align: 'center' as const },
        { title: 'Pieces', dataIndex: 'pieces', key: 'pieces', width: '8%', align: 'center' as const },
      ],
    },
    {
      title: 'Total Cans Sold',
      dataIndex: 'totalCans',
      key: 'totalCans',
      width: '8%',
      align: 'center' as const,
      render: (value: number) => value.toFixed(2),
    },
    { title: 'Total Amount', dataIndex: 'totalAmount', key: 'totalAmount', width: '12%', align: 'center' as const },
    { title: 'Sold By', dataIndex: 'soldBy', key: 'soldBy', width: '12%', align: 'center' as const },
    {
      title: 'Actions',
      key: 'actions',
      width: '10%',
      align: 'center' as const,
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
        </Space>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50" style={{ width: '100vw' }}>
      {/* Navbar */}
      <nav className="navbar">
        <h1 className="navbar-title">KP Ice Factory</h1>
        <Button type="text" icon={<LogoutOutlined />} className="logout-btn">
          Logout
        </Button>
      </nav>

      {/* Main Content */}
      <div className="main-content">
        <Button type="primary" onClick={handleAdd} className="add-sale-btn">
          Add Sale
        </Button>
        <Table
          dataSource={salesWithTotalCans}
          columns={columns}
          rowKey="id"
          className="sales-table"
          scroll={{ x: 'max-content' }}
        />
      </div>

      {/* Printable Bill */}
      <div ref={printRef} className="print-bill">
        {printData && (
          <div className="bill-content">
            <h2>KP Ice Factory - Sales Receipt</h2>
            <p><strong>Date:</strong> {printData.date}</p>
            <p><strong>Unit:</strong> {printData.unit}</p>
            <p><strong>Customer Name:</strong> {printData.name}</p>
            <p><strong>Mobile:</strong> {printData.mobile}</p>
            <p><strong>Shop Name:</strong> {printData.shop}</p>
            <h3>Items Sold:</h3>
            <ul>
              <li>Cans: {printData.cans} @ 240 Rs = {printData.cans * 240} Rs</li>
              <li>Blocks: {printData.blocks} @ 80 Rs = {printData.blocks * 80} Rs</li>
              <li>Pieces: {printData.pieces} @ 20 Rs = {printData.pieces * 20} Rs</li>
            </ul>
            <p><strong>Total Cans:</strong> {calculateTotalCans(printData.cans, printData.blocks, printData.pieces).toFixed(2)}</p>
            <p><strong>Total Amount:</strong> {printData.totalAmount} Rs</p>
            <p><strong>Sold By:</strong> {printData.soldBy}</p>
          </div>
        )}
      </div>

      {/* Modal */}
      <Modal
        title={currentSale ? 'Edit Sale' : 'Add Sale'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        width={640}
        className="sales-modal"
        bodyStyle={{ backgroundColor: '#f9fafb', padding: '2rem' }}
        okButtonProps={{ className: 'modal-ok-btn' }}
        cancelButtonProps={{ className: 'modal-cancel-btn' }}
        footer={[
          <Button key="cancel" className="modal-cancel-btn" onClick={() => setModalVisible(false)}>
            Cancel
          </Button>,
          <Button key="print" type="default" icon={<PrinterOutlined />} onClick={handlePrint}>
            Print Bill
          </Button>,
          <Button key="submit" type="primary" className="modal-ok-btn" onClick={handleSubmit}>
            {currentSale ? 'Update' : 'Add'}
          </Button>,
        ]}
      >
        <Form form={form} layout="vertical" className="sales-form">
          <Form.Item
            name="date"
            label="Date"
            rules={[{ required: true, message: 'Please select a date' }]}
            className="form-item"
          >
            <DatePicker format="YYYY-MM-DD" className="w-full" />
          </Form.Item>
          <Form.Item
            name="unit"
            label="Unit"
            rules={[{ required: true, message: 'Please select a unit' }]}
            className="form-item"
          >
            <Select>
              <Select.Option value="Unit 1">Unit 1</Select.Option>
              <Select.Option value="Unit 2">Unit 2</Select.Option>
              <Select.Option value="Unit 3">Unit 3</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="name"
            label="Name"
            rules={[{ required: true, message: 'Please enter a name' }]}
            className="form-item"
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="mobile"
            label="Mobile"
            rules={[{ required: true, message: 'Please enter a mobile number' }]}
            className="form-item"
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="shop"
            label="Shop"
            rules={[{ required: true, message: 'Please enter a shop name' }]}
            className="form-item"
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="cans"
            label="Cans"
            rules={[{ required: true, message: 'Please enter number of cans' }]}
            className="form-item"
          >
            <InputNumber min={0} className="w-full" />
          </Form.Item>
          <Form.Item
            name="blocks"
            label="Blocks"
            rules={[{ required: true, message: 'Please enter number of blocks' }]}
            className="form-item"
          >
            <InputNumber min={0} className="w-full" />
          </Form.Item>
          <Form.Item
            name="pieces"
            label="Pieces"
            rules={[{ required: true, message: 'Please enter number of pieces' }]}
            className="form-item"
          >
            <InputNumber min={0} className="w-full" />
          </Form.Item>
          <Form.Item label="Total Cans" shouldUpdate className="form-item">
            {() => (
              <span>
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
              <span>
                {calculateTotal(
                  form.getFieldValue('cans') || 0,
                  form.getFieldValue('blocks') || 0,
                  form.getFieldValue('pieces') || 0
                )} Rs
              </span>
            )}
          </Form.Item>
          <Form.Item
            name="soldBy"
            label="Sold By"
            rules={[{ required: true, message: 'Please enter sold by' }]}
            className="form-item col-span-2"
          >
            <Input />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Home;