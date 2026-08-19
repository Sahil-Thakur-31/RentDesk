import bcrypt from 'bcryptjs';
import dayjs from 'dayjs';
import mongoose from 'mongoose';
import { connectDB } from '../config/db';
import { User } from '../models/User';
import { Portfolio } from '../models/Portfolio';
import { Property } from '../models/Property';
import { Unit } from '../models/Unit';
import { Tenant } from '../models/Tenant';
import { RentRecord } from '../models/RentRecord';
import { UtilityBill } from '../models/UtilityBill';
import { MaintenanceExpense } from '../models/MaintenanceExpense';
import { Payment } from '../models/Payment';
import { Document as AppDocument } from '../models/Document';

const fakeBase64 = (label: string) => Buffer.from(`RentDesk demo file: ${label}`, 'utf8').toString('base64');

const monthInfo = (offset: number) => {
  const value = dayjs().startOf('month').add(offset, 'month');
  return {
    key: value.format('YYYY-MM'),
    month: value.month() + 1,
    year: value.year(),
    date: value.date(5).toDate()
  };
};

const electricityAmount = (meterStart: number, meterEnd: number, rate: number, commonCharge: number) =>
  Math.floor(Math.max(0, meterEnd - meterStart) * rate + commonCharge);

const run = async () => {
  await connectDB();

  await Promise.all([
    AppDocument.deleteMany({}),
    Payment.deleteMany({}),
    MaintenanceExpense.deleteMany({}),
    UtilityBill.deleteMany({}),
    RentRecord.deleteMany({}),
    Tenant.deleteMany({}),
    Unit.deleteMany({}),
    Property.deleteMany({}),
    Portfolio.deleteMany({}),
    User.deleteMany({})
  ]);

  const passwordHash = await bcrypt.hash('Pass@1234', 10);

  const [owner, warden, manager] = await User.create([
    {
      fullName: 'Chandan Thakur',
      email: 'chandanthakur10077@gmail.com',
      phone: '9876543210',
      passwordHash,
      role: 'owner',
      isActive: true
    },
    {
      fullName: 'Aditi Patil',
      email: 'aditi.patil@rentdesk.local',
      phone: '9765432101',
      passwordHash,
      role: 'warden',
      isActive: true
    },
    {
      fullName: 'Sahil Thakur',
      email: 'sahilthakur3109@gmail.com',
      phone: '9123456780',
      passwordHash,
      role: 'manager',
      isActive: true
    }
  ]);

  const portfolio = await Portfolio.create({
    name: 'Thakur Portfolio',
    ownerUser: owner._id,
    joinCode: '2145873',
    rentDueDay: 5,
    electricityDueDay: 10,
    maintenanceDueDay: 7,
    reminderLeadDays: 1,
    members: [
      { user: owner._id, role: 'owner', propertyIds: [], addedAt: new Date() },
      { user: warden._id, role: 'warden', propertyIds: [], addedAt: new Date() },
      { user: manager._id, role: 'manager', propertyIds: [], addedAt: new Date() }
    ],
    joinRequests: []
  });

  await User.updateMany(
    { _id: { $in: [owner._id, warden._id, manager._id] } },
    { $set: { activePortfolioId: portfolio._id } }
  );

  const [thakurNivas, cityCommerce] = await Property.create([
    {
      portfolioId: portfolio._id,
      name: 'Thakur Nivas',
      propertyType: 'building',
      address: 'Sinhgad College Road',
      city: 'Pune',
      state: 'Maharashtra',
      pincode: '411041',
      notes: 'Premium apartments with shared water motor and parking lights.',
      maintenanceCharge: 1500,
      electricityUnitRate: 12.5,
      commonElectricityCharge: 100,
      createdBy: owner._id,
      members: [],
      joinRequests: []
    },
    {
      portfolioId: portfolio._id,
      name: 'City Commerce Arcade',
      propertyType: 'commercial',
      address: 'FC Road',
      city: 'Pune',
      state: 'Maharashtra',
      pincode: '411005',
      notes: 'Ground-floor retail units with evening footfall.',
      maintenanceCharge: 800,
      electricityUnitRate: 14,
      commonElectricityCharge: 60,
      createdBy: owner._id,
      members: [],
      joinRequests: []
    }
  ]);

  portfolio.members.forEach((member) => {
    if (String(member.user) === String(owner._id)) {
      member.propertyIds = [thakurNivas._id as any, cityCommerce._id as any];
      return;
    }

    if (String(member.user) === String(warden._id)) {
      member.propertyIds = [thakurNivas._id as any, cityCommerce._id as any];
      return;
    }

    member.propertyIds = [thakurNivas._id as any];
  });
  await portfolio.save();

  const [unitA1, unitA2, unitA3, shop101, shop102] = await Unit.create([
    {
      propertyId: thakurNivas._id,
      unitNumber: 'A1',
      unitType: '2bhk',
      floor: '1',
      monthlyRent: 22000,
      deposit: 40000,
      status: 'vacant',
      lastMeterReading: 0
    },
    {
      propertyId: thakurNivas._id,
      unitNumber: 'A2',
      unitType: '1bhk',
      floor: '1',
      monthlyRent: 18000,
      deposit: 30000,
      status: 'vacant',
      lastMeterReading: 0
    },
    {
      propertyId: thakurNivas._id,
      unitNumber: 'A3',
      unitType: 'single_room',
      floor: '2',
      monthlyRent: 9000,
      deposit: 15000,
      maintenanceMode: true,
      status: 'maintenance',
      lastMeterReading: 0
    },
    {
      propertyId: cityCommerce._id,
      unitNumber: 'S1',
      unitType: 'shop',
      floor: 'Ground',
      monthlyRent: 28000,
      deposit: 50000,
      status: 'vacant',
      lastMeterReading: 0
    },
    {
      propertyId: cityCommerce._id,
      unitNumber: 'S2',
      unitType: 'shop',
      floor: 'Ground',
      monthlyRent: 32000,
      deposit: 60000,
      status: 'vacant',
      lastMeterReading: 0
    }
  ]);

  const [karan, nisha, meera, rohan] = await Tenant.create([
    {
      propertyId: thakurNivas._id,
      unitId: unitA1._id,
      fullName: 'Karan Shah',
      phone: '9988776655',
      email: 'karan.shah@example.com',
      idProofType: 'Aadhaar',
      idProofNumber: '7845-1234-9981',
      emergencyContact: 'Priya Shah - 9988776600',
      rentAmount: unitA1.monthlyRent,
      depositAmount: unitA1.deposit,
      assignedUnit: unitA1._id,
      photoBase64: fakeBase64('karan-photo'),
      documents: {
        idProofBase64: fakeBase64('karan-id-proof'),
        policeVerificationBase64: fakeBase64('karan-police-verification')
      },
      isActive: true,
      movedInDate: dayjs().subtract(5, 'month').date(3).toDate()
    },
    {
      propertyId: thakurNivas._id,
      unitId: unitA2._id,
      fullName: 'Nisha Kulkarni',
      phone: '9870011223',
      email: 'nisha.kulkarni@example.com',
      idProofType: 'PAN',
      idProofNumber: 'BQAPK1234D',
      emergencyContact: 'Madhav Kulkarni - 9870011999',
      rentAmount: unitA2.monthlyRent,
      depositAmount: unitA2.deposit,
      assignedUnit: unitA2._id,
      photoBase64: fakeBase64('nisha-photo'),
      documents: {
        idProofBase64: fakeBase64('nisha-id-proof')
      },
      isActive: false,
      movedInDate: dayjs().subtract(10, 'month').date(1).toDate(),
      movedOutDate: dayjs().subtract(2, 'month').toDate()
    },
    {
      propertyId: cityCommerce._id,
      unitId: shop101._id,
      fullName: 'Meera Enterprises',
      phone: '9812345678',
      email: 'billing@meeraenterprises.in',
      idProofType: 'GST',
      idProofNumber: '27ABCDE1234F1Z9',
      emergencyContact: 'Meera Joshi - 9812345678',
      rentAmount: shop101.monthlyRent,
      depositAmount: shop101.deposit,
      assignedUnit: shop101._id,
      photoBase64: fakeBase64('meera-logo'),
      documents: {
        idProofBase64: fakeBase64('meera-gst-certificate')
      },
      isActive: true,
      movedInDate: dayjs().subtract(6, 'month').date(10).toDate()
    },
    {
      propertyId: thakurNivas._id,
      unitId: unitA2._id,
      fullName: 'Rohan Deshmukh',
      phone: '9822334455',
      email: 'rohan.deshmukh@example.com',
      idProofType: 'Aadhaar',
      idProofNumber: '5566-7788-9900',
      emergencyContact: 'Sunita Deshmukh - 9822334400',
      rentAmount: unitA2.monthlyRent,
      depositAmount: unitA2.deposit,
      assignedUnit: unitA2._id,
      photoBase64: fakeBase64('rohan-photo'),
      documents: {
        idProofBase64: fakeBase64('rohan-id-proof'),
        policeVerificationBase64: fakeBase64('rohan-police-verification')
      },
      isActive: true,
      movedInDate: dayjs().subtract(20, 'day').toDate()
    }
  ]);

  await Promise.all([
    Unit.findByIdAndUpdate(unitA1._id, {
      status: 'occupied',
      currentTenant: karan._id
    }),
    Unit.findByIdAndUpdate(unitA2._id, {
      status: 'occupied',
      currentTenant: rohan._id
    }),
    Unit.findByIdAndUpdate(shop101._id, {
      status: 'occupied',
      currentTenant: meera._id
    })
  ]);

  const prev2 = monthInfo(-2);
  const prev1 = monthInfo(-1);
  const current = monthInfo(0);

  const electricityBills = [
    {
      propertyId: thakurNivas._id,
      unitId: unitA1._id,
      billType: 'electricity' as const,
      month: prev2.key,
      meterStart: 0,
      meterEnd: 17,
      unitsConsumed: 17,
      amount: electricityAmount(0, 17, thakurNivas.electricityUnitRate || 0, thakurNivas.commonElectricityCharge || 0),
      status: 'paid' as const
    },
    {
      propertyId: thakurNivas._id,
      unitId: unitA1._id,
      billType: 'electricity' as const,
      month: prev1.key,
      meterStart: 17,
      meterEnd: 31,
      unitsConsumed: 14,
      amount: electricityAmount(17, 31, thakurNivas.electricityUnitRate || 0, thakurNivas.commonElectricityCharge || 0),
      status: 'paid' as const
    },
    {
      propertyId: thakurNivas._id,
      unitId: unitA1._id,
      billType: 'electricity' as const,
      month: current.key,
      meterStart: 31,
      meterEnd: 49,
      unitsConsumed: 18,
      amount: electricityAmount(31, 49, thakurNivas.electricityUnitRate || 0, thakurNivas.commonElectricityCharge || 0),
      status: 'unpaid' as const
    },
    {
      propertyId: cityCommerce._id,
      unitId: shop101._id,
      billType: 'electricity' as const,
      month: prev1.key,
      meterStart: 240,
      meterEnd: 278,
      unitsConsumed: 38,
      amount: electricityAmount(240, 278, cityCommerce.electricityUnitRate || 0, cityCommerce.commonElectricityCharge || 0),
      status: 'paid' as const
    },
    {
      propertyId: cityCommerce._id,
      unitId: shop101._id,
      billType: 'electricity' as const,
      month: current.key,
      meterStart: 278,
      meterEnd: 326,
      unitsConsumed: 48,
      amount: electricityAmount(278, 326, cityCommerce.electricityUnitRate || 0, cityCommerce.commonElectricityCharge || 0),
      status: 'paid' as const
    }
  ];

  const createdBills = await UtilityBill.create(electricityBills);

  await Promise.all([
    Unit.findByIdAndUpdate(unitA1._id, {
      lastMeterReading: 49,
      lastMeterReadingDate: current.date
    }),
    Unit.findByIdAndUpdate(shop101._id, {
      lastMeterReading: 326,
      lastMeterReadingDate: current.date
    })
  ]);

  const rentRecords = await RentRecord.create([
    {
      propertyId: thakurNivas._id,
      unitId: unitA1._id,
      tenantId: karan._id,
      month: prev1.month,
      year: prev1.year,
      rentAmount: unitA1.monthlyRent,
      status: 'paid',
      paidAmount: unitA1.monthlyRent,
      paidDate: dayjs(prev1.date).date(3).toDate(),
      paymentMode: 'UPI'
    },
    {
      propertyId: thakurNivas._id,
      unitId: unitA1._id,
      tenantId: karan._id,
      month: current.month,
      year: current.year,
      rentAmount: unitA1.monthlyRent,
      status: 'paid',
      paidAmount: unitA1.monthlyRent,
      paidDate: dayjs(current.date).date(4).toDate(),
      paymentMode: 'UPI'
    },
    {
      propertyId: cityCommerce._id,
      unitId: shop101._id,
      tenantId: meera._id,
      month: prev1.month,
      year: prev1.year,
      rentAmount: shop101.monthlyRent,
      status: 'paid',
      paidAmount: shop101.monthlyRent,
      paidDate: dayjs(prev1.date).date(5).toDate(),
      paymentMode: 'Bank Transfer'
    },
    {
      propertyId: cityCommerce._id,
      unitId: shop101._id,
      tenantId: meera._id,
      month: current.month,
      year: current.year,
      rentAmount: shop101.monthlyRent,
      status: 'partial',
      paidAmount: 18000,
      paidDate: dayjs(current.date).date(8).toDate(),
      paymentMode: 'Bank Transfer'
    },
    {
      propertyId: thakurNivas._id,
      unitId: unitA2._id,
      tenantId: rohan._id,
      month: current.month,
      year: current.year,
      rentAmount: unitA2.monthlyRent,
      status: 'unpaid',
      paymentMode: 'UPI'
    }
  ]);

  await MaintenanceExpense.create([
    {
      propertyId: thakurNivas._id,
      date: dayjs(current.date).date(2).toDate(),
      category: 'Lift Repair',
      description: 'Door sensor and emergency light service.',
      amount: 7500,
      paidTo: 'Skyline Elevators'
    },
    {
      propertyId: thakurNivas._id,
      date: dayjs(prev1.date).date(18).toDate(),
      category: 'Cleaning Staff',
      description: 'Monthly cleaning payment for common staircase and parking.',
      amount: 2200,
      paidTo: 'Prakash Services'
    },
    {
      propertyId: cityCommerce._id,
      date: dayjs(current.date).date(11).toDate(),
      category: 'Shutter Repair',
      description: 'Main shutter spring replacement.',
      amount: 1800,
      paidTo: 'A1 Fabrication'
    }
  ]);

  await Payment.create([
    {
      type: 'deposit',
      amount: 25000,
      date: dayjs().subtract(45, 'day').toDate(),
      propertyId: thakurNivas._id,
      unitId: unitA1._id,
      tenantId: karan._id,
      notes: 'Security deposit collected'
    },
    {
      type: 'deposit',
      amount: 50000,
      date: dayjs().subtract(4, 'month').toDate(),
      propertyId: cityCommerce._id,
      unitId: shop101._id,
      tenantId: meera._id,
      notes: 'Security deposit collected'
    },
    {
      type: 'deposit',
      amount: 30000,
      date: dayjs().subtract(8, 'month').toDate(),
      propertyId: thakurNivas._id,
      unitId: unitA2._id,
      tenantId: nisha._id,
      notes: 'Security deposit collected'
    },
    {
      type: 'refund',
      amount: 30000,
      date: dayjs().subtract(2, 'month').add(2, 'day').toDate(),
      propertyId: thakurNivas._id,
      unitId: unitA2._id,
      tenantId: nisha._id,
      notes: 'Security deposit returned on move out'
    },
    {
      type: 'deposit',
      amount: unitA2.deposit,
      date: dayjs().subtract(20, 'day').toDate(),
      propertyId: thakurNivas._id,
      unitId: unitA2._id,
      tenantId: rohan._id,
      notes: 'Security deposit collected'
    },
    {
      type: 'rent',
      amount: unitA1.monthlyRent,
      date: dayjs(prev1.date).date(3).toDate(),
      propertyId: thakurNivas._id,
      unitId: unitA1._id,
      tenantId: karan._id,
      notes: `Rent received for ${prev1.key}`,
      sourceType: 'rentRecord',
      sourceId: rentRecords[0]._id
    },
    {
      type: 'rent',
      amount: unitA1.monthlyRent,
      date: dayjs(current.date).date(4).toDate(),
      propertyId: thakurNivas._id,
      unitId: unitA1._id,
      tenantId: karan._id,
      notes: `Rent received for ${current.key}`,
      sourceType: 'rentRecord',
      sourceId: rentRecords[1]._id
    },
    {
      type: 'rent',
      amount: shop101.monthlyRent,
      date: dayjs(prev1.date).date(5).toDate(),
      propertyId: cityCommerce._id,
      unitId: shop101._id,
      tenantId: meera._id,
      notes: `Rent received for ${prev1.key}`,
      sourceType: 'rentRecord',
      sourceId: rentRecords[2]._id
    },
    {
      type: 'rent',
      amount: 18000,
      date: dayjs(current.date).date(8).toDate(),
      propertyId: cityCommerce._id,
      unitId: shop101._id,
      tenantId: meera._id,
      notes: `Partial rent received for ${current.key}`,
      sourceType: 'rentRecord',
      sourceId: rentRecords[3]._id
    },
    {
      type: 'utility',
      amount: createdBills[0].amount,
      date: dayjs(prev2.date).date(28).toDate(),
      propertyId: thakurNivas._id,
      unitId: unitA1._id,
      tenantId: karan._id,
      notes: `Electricity bill paid for ${prev2.key}`,
      sourceType: 'utilityBill',
      sourceId: createdBills[0]._id
    },
    {
      type: 'utility',
      amount: createdBills[1].amount,
      date: dayjs(prev1.date).date(27).toDate(),
      propertyId: thakurNivas._id,
      unitId: unitA1._id,
      tenantId: karan._id,
      notes: `Electricity bill paid for ${prev1.key}`,
      sourceType: 'utilityBill',
      sourceId: createdBills[1]._id
    },
    {
      type: 'utility',
      amount: createdBills[3].amount,
      date: dayjs(prev1.date).date(26).toDate(),
      propertyId: cityCommerce._id,
      unitId: shop101._id,
      tenantId: meera._id,
      notes: `Electricity bill paid for ${prev1.key}`,
      sourceType: 'utilityBill',
      sourceId: createdBills[3]._id
    },
    {
      type: 'utility',
      amount: createdBills[4].amount,
      date: dayjs(current.date).date(16).toDate(),
      propertyId: cityCommerce._id,
      unitId: shop101._id,
      tenantId: meera._id,
      notes: `Electricity bill paid for ${current.key}`,
      sourceType: 'utilityBill',
      sourceId: createdBills[4]._id
    },
    {
      type: 'maintenance',
      amount: thakurNivas.maintenanceCharge || 0,
      date: dayjs(current.date).date(4).toDate(),
      propertyId: thakurNivas._id,
      unitId: unitA1._id,
      tenantId: karan._id,
      notes: 'Maintenance collected'
    },
    {
      type: 'maintenance',
      amount: cityCommerce.maintenanceCharge || 0,
      date: dayjs(current.date).date(7).toDate(),
      propertyId: cityCommerce._id,
      unitId: shop101._id,
      tenantId: meera._id,
      notes: 'Maintenance collected'
    },
    {
      type: 'other',
      amount: 2500,
      date: dayjs(current.date).date(10).toDate(),
      propertyId: cityCommerce._id,
      unitId: shop101._id,
      tenantId: meera._id,
      notes: 'Signage board contribution'
    }
  ]);

  await AppDocument.create([
    {
      ownerType: 'tenant',
      ownerId: karan._id,
      name: 'karan-id-proof.txt',
      mimeType: 'text/plain',
      base64: fakeBase64('karan-doc'),
      createdBy: owner._id
    },
    {
      ownerType: 'tenant',
      ownerId: meera._id,
      name: 'meera-gst.txt',
      mimeType: 'text/plain',
      base64: fakeBase64('meera-doc'),
      createdBy: owner._id
    },
    {
      ownerType: 'tenant',
      ownerId: rohan._id,
      name: 'rohan-id-proof.txt',
      mimeType: 'text/plain',
      base64: fakeBase64('rohan-doc'),
      createdBy: owner._id
    }
  ]);

  console.log('Seed completed successfully.');
  console.log('Login credentials:');
  console.log('Owner: chandanthakur10077@gmail.com / Pass@1234');
  console.log('Warden: aditi.patil@rentdesk.local / Pass@1234');
  console.log('Manager: sahilthakur3109@gmail.com / Pass@1234');
  console.log('');
  console.log('Created data:');
  console.log('- 3 users');
  console.log('- 2 properties');
  console.log('- 5 units');
  console.log('- 4 tenants (3 active, 1 moved out)');
  console.log('- 5 rent records');
  console.log('- 5 electricity bills');
  console.log('- 3 maintenance expenses');
  console.log('- 16 payments');
  console.log('- 3 stored documents');
};

run()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
