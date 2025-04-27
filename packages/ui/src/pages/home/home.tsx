import React, { useState, useEffect, useCallback, useMemo, FC } from 'react';
import { motion } from 'framer-motion';
import { Table, Modal, Form, Input, InputNumber, DatePicker, Button, Space, Select, Menu, Dropdown } from 'antd';
import { DeleteOutlined, EditOutlined, PrinterOutlined, LogoutOutlined } from '@ant-design/icons';
import moment from 'moment';
import * as XLSX from 'xlsx';
import Cookies from 'js-cookie';
import { useNavigate } from 'react-router-dom';
import './home.css';
import Navbar from '../navbar/navbar';
import { ColumnsType } from 'antd/es/table';
import { CommonResponse, SaleUpdateDto } from '@nihal-ice-factory/shared-models';
import { SalesHelpService } from '@nihal-ice-factory/shared-services';
import _ from 'lodash';

// Define frontend Unit type
type Unit = 'Unit 1' | 'Unit 2' | 'Unit 3' | string;

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
  totalCans: number | string;
  soldBy: string;
}

// Define CreateSaleDto to match CreateSaleModel
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

// Define UpdateSaleDto to match UpdateSaleModel
interface UpdateSaleDto {
  date?: string;
  time?: string;
  unit?: string;
  name?: string;
  mobile?: string;
  shop?: string;
  cans?: number;
  blocks?: number;
  pieces?: number;
  totalCans?: number;
  discount?: number;
  totalAmount?: number;
  soldBy?: string;
}

const Home: FC = () => {
  const [sales, setSales] = useState<Sale[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [currentSale, setCurrentSale] = useState<Sale | null>(null);
  const [form] = Form.useForm();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [role, setRole] = useState<string>('USER');
  const [loading, setLoading] = useState<boolean>(false);
  const navigate = useNavigate();
  const salesService = useMemo(() => new SalesHelpService(), []);

  // Debounced fetchSales to prevent rapid API calls
  const debouncedFetchSales = useCallback(
    _.debounce(async (token: string) => {
      setLoading(true);
      try {
        const config = {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        };

        const response: CommonResponse = await salesService.getAllSales(config);

        if (!response || typeof response !== 'object') {
          throw new Error('Invalid response structure from server');
        }

        if (response.status && response.errorCode === 200) {
          const nestedData = response.data && typeof response.data === 'object' ? response.data.data : [];
          const salesData = Array.isArray(nestedData) ? nestedData : [];
          const normalizedSales = salesData.map(sale => ({
            ...sale,
            totalCans: typeof sale.totalCans === 'string' ? parseFloat(sale.totalCans) : sale.totalCans,
          }));
          setSales(normalizedSales);
          Modal.success({
            title: 'Success',
            content: response.internalMessage || 'Sales fetched successfully',
          });
        } else {
          throw new Error(response.internalMessage || 'Failed to fetch sales');
        }
      } catch (error: any) {
        console.error('Error fetching sales:', error);
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
            content:
              error.response?.data?.internalMessage ||
              error.message ||
              'An error occurred while fetching sales',
          });
        }
      } finally {
        setLoading(false);
      }
    }, 200),
    [navigate, salesService]
  );

  // Check authentication and fetch sales
  useEffect(() => {
    const accessToken = Cookies.get('accessToken');
    if (!accessToken) {
      navigate('/login', { replace: true });
      return;
    }

    const jsrole = Cookies.get('userRole')?.toUpperCase();
    setRole(jsrole || 'USER');
    debouncedFetchSales(accessToken);

    return () => {
      debouncedFetchSales.cancel();
    };
  }, [debouncedFetchSales, navigate]);

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

  const handleAdd = useCallback(() => {
    setCurrentSale(null);
    form.resetFields();
    form.setFieldsValue({
      time: moment(),
      date: moment(),
      discount: 0,
      unit: undefined,
      name: undefined,
      mobile: undefined,
      shop: undefined,
      cans: undefined,
      blocks: undefined,
      pieces: undefined,
      soldBy: undefined,
    });
    setModalVisible(true);
  }, [form]);

  const handleLogout = useCallback(() => {
    Cookies.remove('accessToken');
    Cookies.remove('userRole');
    navigate('/login');
  }, [navigate]);

  const menu = useMemo(
    () => (
      <Menu>
        <Menu.Item key="logout" onClick={handleLogout} icon={<LogoutOutlined />}>
          Logout
        </Menu.Item>
      </Menu>
    ),
    [handleLogout]
  );

  const handleEdit = useCallback(
    (sale: Sale) => {
      console.log('Editing sale with ID:', sale.id); // Debug log
      setCurrentSale(sale);
      form.setFieldsValue({
        ...sale,
        date: moment(sale.date, 'YYYY-MM-DD', true).isValid() ? moment(sale.date, 'YYYY-MM-DD') : moment(),
        time: moment(sale.time, 'HH:mm', true).isValid() ? moment(sale.time, 'HH:mm') : moment(),
        unit: sale.unit,
      });
      setModalVisible(true);
    },
    [form]
  );

  const handleDelete = useCallback(
    (id: number) => {
      Modal.confirm({
        title: 'Are you sure you want to delete this sale?',
        onOk: async () => {
          try {
            setLoading(true);
            const accessToken = Cookies.get('accessToken');
            if (!accessToken) {
              throw new Error('No access token found');
            }
            const config = {
              headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
              },
            };
            console.log('Deleting sale with ID:', id); // Debug log
            const response: CommonResponse = await salesService.deleteSale(id, config);
            console.log('Delete response:', response); // Debug log
            if (response.status && response.errorCode === 200) {
              setSales(prev => prev.filter(sale => sale.id !== id));
              Modal.success({
                title: 'Success',
                content: response.internalMessage || 'Sale deleted successfully',
              });
            } else {
              throw new Error(response.internalMessage || 'Failed to delete sale');
            }
          } catch (error: any) {
            console.error('Error deleting sale:', error);
            Modal.error({
              title: 'Error',
              content: error.response?.data?.internalMessage || error.message || 'An error occurred while deleting the sale',
            });
            if (error.response?.status === 401) {
              Cookies.remove('accessToken');
              Cookies.remove('userRole');
              Modal.error({
                title: 'Session Expired',
                content: 'Your session has expired. Please log in again.',
                onOk: () => navigate('/login', { replace: true }),
              });
            }
          } finally {
            setLoading(false);
          }
        },
      });
    },
    [navigate, salesService]
  );

  const handleBulkDelete = useCallback(() => {
    Modal.confirm({
      title: `Are you sure you want to delete ${selectedRowKeys.length} selected sales?`,
      onOk: async () => {
        try {
          setLoading(true);
          const accessToken = Cookies.get('accessToken');
          if (!accessToken) {
            throw new Error('No access token found');
          }
          const config = {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
          };
          const deletePromises = selectedRowKeys.map(id => salesService.deleteSale(Number(id), config));
          const responses = await Promise.all(deletePromises);
          const failed = responses.some(res => !res.status || res.errorCode !== 200);
          if (!failed) {
            setSales(prev => prev.filter(sale => !selectedRowKeys.includes(sale.id)));
            setSelectedRowKeys([]);
            Modal.success({
              title: 'Success',
              content: 'Selected sales deleted successfully',
            });
          } else {
            throw new Error('Some sales could not be deleted');
          }
        } catch (error: any) {
          console.error('Error bulk deleting sales:', error);
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
              content: error.message || 'An error occurred while deleting sales',
            });
          }
        } finally {
          setLoading(false);
        }
      },
    });
  }, [selectedRowKeys, navigate, salesService]);

  const handleSubmit = useCallback(
    async () => {
      try {
        const values = await form.validateFields();
        setLoading(true);
  
        // Build auth config once
        const accessToken = Cookies.get('accessToken');
        if (!accessToken) throw new Error('No access token found');
        const config = {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        };
  
        // Shared base payload (including computed fields)
        const baseData = {
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
  
        let response: CommonResponse;
  
        if (currentSale) {
          // —————— UPDATE FLOW ——————
  
          // Remove computed fields before sending
          const { totalAmount, totalCans, ...updatePayload } = baseData;
          console.debug('Updating sale (sans computed fields):', currentSale.id, updatePayload);
  
          response = await salesService.updateSale(
            currentSale.id,
            updatePayload as SaleUpdateDto,
            config,
          );
          console.debug('Update response:', response);
  
          // Unwrap nested data
          const level1 = response.data?.data;
          const inner = level1?.data ?? level1;
  
          if (!response.status || response.errorCode !== 200) {
            throw new Error(
              level1?.internalMessage ||
              response.internalMessage ||
              'Failed to update sale'
            );
          }
  
          const updatedSale = {
            ...inner,
            totalCans: Number(inner.totalCans),
          };
  
          // Update list and UI
          setSales(prev =>
            prev.map(s => (s.id === currentSale.id ? updatedSale : s))
          );
          Modal.success({
            title: 'Sale Updated',
            content: level1?.internalMessage || 'Sale updated successfully',
          });
  
          // Reset modal & form
          form.resetFields();
          setCurrentSale(null);
          setModalVisible(false);
        } else {
          // —————— CREATE FLOW (unchanged) ——————
          const createDto: CreateSaleDto = baseData;
          console.debug('Creating sale:', createDto);
  
          response = await salesService.createSale(createDto, config);
          console.debug('Create response:', response);
  
          if (response.status && response.errorCode === 201) {
            const raw = response.data?.data ?? response.data;
            const newSale = { ...raw, totalCans: Number(raw.totalCans) };
            setSales(prev => [newSale, ...prev]);
            Modal.success({
              title: 'Sale Created',
              content: response.internalMessage || 'Sale created successfully',
            });
            form.resetFields();
            setModalVisible(false);
            setCurrentSale(null);
          } else {
            throw new Error(response.internalMessage || 'Failed to create sale');
          }
        }
      } catch (error: any) {
        console.error('Error submitting sale:', error.response?.data || error);
        Modal.error({
          title: error.response?.status === 401 ? 'Session Expired' : 'Error',
          content: error.response?.data?.internalMessage || error.message,
          onOk:
            error.response?.status === 401
              ? () => {
                  Cookies.remove('accessToken');
                  Cookies.remove('userRole');
                  navigate('/login', { replace: true });
                }
              : undefined,
        });
      } finally {
        setLoading(false);
      }
    },
    [form, currentSale, navigate, calculateTotal, calculateTotalCans, salesService]
  );
  

  const generatePrintContent = useCallback((records: Sale[]) => {
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
          ${records
            .map(
              record => `
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
              <p class="total"><strong>Total Cans:</strong> ${Number(record.totalCans).toFixed(2)}</p>
              <p class="total"><strong>Total Amount:</strong> ${record.totalAmount} Rs</p>
              <p><strong>Sold By:</strong> ${record.soldBy}</p>
            </div>
          `
            )
            .join('')}
        </body>
      </html>
    `;
  }, []);

  const handlePrint = useCallback(
    async (record: Sale) => {
      try {
        setLoading(true);
        const accessToken = Cookies.get('accessToken');
        if (!accessToken) {
          throw new Error('No access token found');
        }
        const config = {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        };
        const response: CommonResponse = await salesService.getPrintData(record.id, config);
        if (response.status && response.errorCode === 200) {
          const printData = response.data && typeof response.data === 'object' && response.data.data
            ? {
                ...response.data.data,
                totalCans: typeof response.data.data.totalCans === 'string'
                  ? parseFloat(response.data.data.totalCans)
                  : response.data.data.totalCans,
              }
            : response.data;
          const printWindow = window.open('', '_blank');
          if (printWindow) {
            printWindow.document.write(generatePrintContent([printData]));
            printWindow.document.close();
            printWindow.print();
          }
          Modal.success({
            title: 'Success',
            content: response.internalMessage || 'Print data fetched successfully',
          });
        } else {
          throw new Error(response.internalMessage || 'Failed to fetch print data');
        }
      } catch (error: any) {
        console.error('Error printing sale:', error);
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
            content: error.message || 'An error occurred while fetching print data',
          });
        }
      } finally {
        setLoading(false);
      }
    },
    [navigate, generatePrintContent, salesService]
  );

  const handleBulkPrint = useCallback(
    async () => {
      const selectedRecords = sales.filter(sale => selectedRowKeys.includes(sale.id));
      if (selectedRecords.length === 0) {
        Modal.warning({
          title: 'No records selected',
          content: 'Please select at least one sale to print.',
        });
        return;
      }
      try {
        setLoading(true);
        const accessToken = Cookies.get('accessToken');
        if (!accessToken) {
          throw new Error('No access token found');
        }
        const config = {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        };
        const printPromises = selectedRecords.map(record => salesService.getPrintData(record.id, config));
        const responses = await Promise.all(printPromises);
        const printData = responses
          .filter(res => res.status && res.errorCode === 200)
          .map(res => {
            const data = res.data && typeof res.data === 'object' && res.data.data
              ? {
                  ...res.data.data,
                  totalCans: typeof res.data.data.totalCans === 'string'
                    ? parseFloat(res.data.data.totalCans)
                    : res.data.data.totalCans,
                }
              : res.data;
            return data;
          });
        if (printData.length > 0) {
          const printWindow = window.open('', '_blank');
          if (printWindow) {
            printWindow.document.write(generatePrintContent(printData));
            printWindow.document.close();
            printWindow.print();
          }
          Modal.success({
            title: 'Success',
            content: 'Print data fetched successfully',
          });
        } else {
          throw new Error('Failed to fetch print data for selected sales');
        }
      } catch (error: any) {
        console.error('Error bulk printing sales:', error);
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
            content: error.message || 'An error occurred while fetching print data',
          });
        }
      } finally {
        setLoading(false);
      }
    },
    [selectedRowKeys, sales, navigate, generatePrintContent, salesService]
  );

  const handleExportExcel = useCallback(() => {
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
      'Total Cans': Number(sale.totalCans).toFixed(2),
      'Total Amount': sale.totalAmount,
      'Sold By': sale.soldBy,
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sales');
    XLSX.writeFile(wb, 'sales_data.xlsx');
  }, [sales]);

  const columns: ColumnsType<Sale> = useMemo(
    () => [
      { title: 'Serial No', dataIndex: 'id', key: 'id', width: '8%', align: 'center' as const },
      { title: 'Date', dataIndex: 'date', key: 'date', width: '10%', align: 'center' as const },
      { title: 'Time', dataIndex: 'time', key: 'time', width: '8%', align: 'center' as const },
      {
        title: 'Unit',
        dataIndex: 'unit',
        key: 'unit',
        width: '12%',
        align: 'center' as const,
        render: (unit: Unit) => unit,
      },
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
        title: 'Total Cans',
        dataIndex: 'totalCans',
        key: 'totalCans',
        width: '8%',
        align: 'center' as const,
        render: (value: number | string) => Number(value).toFixed(2),
      },
      { title: 'Discount', dataIndex: 'discount', key: 'discount', width: '8%', align: 'center' as const },
      { title: 'Total Amount', dataIndex: 'totalAmount', key: 'totalAmount', width: '12%', align: 'center' as const },
      { title: 'Sold By', dataIndex: 'soldBy', key: 'soldBy', width: '12%', align: 'center' as const },
      {
        title: 'Actions',
        key: 'actions',
        width: '10%',
        align: 'center' as const,
        render: (_: any, record: Sale, index: number) => (
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
    ],
    [handleEdit, handleDelete, handlePrint]
  );

  const rowSelection = useMemo(
    () => ({
      selectedRowKeys,
      onChange: (selectedKeys: React.Key[]) => {
        setSelectedRowKeys(selectedKeys);
      },
    }),
    [selectedRowKeys]
  );

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
            <h3>Sales Management - KP Ice Factory</h3>
          </div>
          <Dropdown overlay={menu} placement="bottomCenter" trigger={['hover']}>
            <div className="user-info" style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
              <span className="user-icon">👤</span>
              <span>{role}</span>
            </div>
          </Dropdown>
        </motion.header>
        <motion.div className="content" variants={containerVariants} initial="hidden" animate="visible">
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
            <Table<Sale>
              dataSource={sales}
              columns={columns}
              rowKey="id"
              className="sales-table"
              scroll={{ x: 'max-content' }}
              pagination={{ pageSize: 10, showSizeChanger: false }}
              rowSelection={rowSelection}
              loading={loading}
            />
          </motion.div>
        </motion.div>
      </div>
      <Modal
        title={currentSale ? 'Edit Sale' : 'Add Sale'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => {
          setModalVisible(false);
          form.resetFields();
          setCurrentSale(null);
        }}
        width="90%"
        style={{ maxWidth: '720px', margin: '24px auto' }}
        className="sales-modal"
        bodyStyle={{
          backgroundColor: '#ffffff',
          padding: '32px',
          borderRadius: '12px',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.15)',
        }}
        okButtonProps={{ className: 'modal-ok-btn', loading: loading }}
        cancelButtonProps={{ className: 'modal-cancel-btn' }}
        footer={[
          <Button
            key="cancel"
            className="modal-cancel-btn"
            onClick={() => {
              setModalVisible(false);
              form.resetFields();
              setCurrentSale(null);
            }}
            style={{
              borderRadius: '8px',
              padding: '8px 20px',
              fontWeight: 500,
              borderColor: '#d1d5db',
              color: '#4b5563',
              background: '#ffffff',
            }}
          >
            Cancel
          </Button>,
          <Button
            key="submit"
            type="primary"
            className="modal-ok-btn"
            onClick={handleSubmit}
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
            {currentSale ? 'Update' : 'Add'}
          </Button>,
        ]}
      >
        <Form form={form} layout="vertical" className="sales-form">
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
          </div>
        </Form>
      </Modal>
    </div>
  );
};

export default React.memo(Home);