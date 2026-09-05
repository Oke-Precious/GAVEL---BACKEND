const mongoose = require('mongoose');
const User = require('../models/User');
const Case = require('../models/Case');
const StatusHistory = require('../models/StatusHistory');
const CaseDocument = require('../models/CaseDocument');
const env = require('../config/env');

const seedData = async () => {
  try {
    if (!env.MONGO_URI) {
      console.error('MONGO_URI is not defined in environment!');
      process.exit(1);
    }

    console.log('Connecting to MongoDB...');
    await mongoose.connect(env.MONGO_URI);
    console.log('Connected to MongoDB.');

    console.log('Cleaning existing data...');
    await User.deleteMany({});
    await Case.deleteMany({});
    await StatusHistory.deleteMany({});
    await CaseDocument.deleteMany({});

    console.log('Creating demo users...');

    // Demo password for all test accounts
    const defaultPassword = 'Password123!';

    const admin = await User.create({
      firstName: 'System',
      lastName: 'Admin',
      email: 'admin@gavel.app',
      password: defaultPassword,
      role: 'admin',
      isEmailVerified: true,
      phoneNumber: '+2348011111111'
    });

    const judge = await User.create({
      firstName: 'Hon. Justice',
      lastName: 'Adebayo',
      email: 'judge@gavel.app',
      password: defaultPassword,
      role: 'judge',
      isEmailVerified: true,
      phoneNumber: '+2348022222222'
    });

    const lawyer = await User.create({
      firstName: 'Barrister',
      lastName: 'Okonkwo',
      email: 'lawyer@gavel.app',
      password: defaultPassword,
      role: 'lawyer',
      barNumber: 'NBA/2020/09845',
      isEmailVerified: true,
      phoneNumber: '+2348033333333'
    });

    const clerk = await User.create({
      firstName: 'Court',
      lastName: 'Registrar',
      email: 'clerk@gavel.app',
      password: defaultPassword,
      role: 'clerk',
      isEmailVerified: true,
      phoneNumber: '+2348044444444'
    });

    const litigant = await User.create({
      firstName: 'John',
      lastName: 'Doe',
      email: 'litigant@gavel.app',
      password: defaultPassword,
      role: 'litigant',
      isEmailVerified: true,
      phoneNumber: '+2348055555555'
    });

    console.log('Created Users:');
    console.log(' - Admin: admin@gavel.app');
    console.log(' - Judge: judge@gavel.app');
    console.log(' - Lawyer: lawyer@gavel.app');
    console.log(' - Clerk: clerk@gavel.app');
    console.log(' - Litigant: litigant@gavel.app');

    console.log('Creating sample cases...');

    const case1 = await Case.create({
      caseNumber: 'FHC/L/CS/2026/001',
      title: 'State vs. Federal Housing Commission',
      description: 'Dispute over public land allocation in Lagos High Court jurisdiction.',
      stage: 'Trial',
      status: 'Active',
      court: 'Lagos High Court 1',
      plaintiffs: ['State Government'],
      defendants: ['Federal Housing Commission'],
      judge: judge._id,
      lawyers: [lawyer._id],
      isProBono: false,
      filingDate: new Date('2026-01-15')
    });

    const case2 = await Case.create({
      caseNumber: 'FHC/IKJ/CS/2026/042',
      title: 'Civil Liberties Defense vs. Custodial Service',
      description: 'Human rights enforcement and unlawful pre-trial detention petition.',
      stage: 'Pre-Trial',
      status: 'Active',
      court: 'Ikeja High Court 3',
      plaintiffs: ['Samuel Chukwuma'],
      defendants: ['Correctional Facility Superintendent'],
      judge: judge._id,
      lawyers: [], // Unrepresented pro-bono case
      isProBono: true,
      detentionDate: new Date('2025-11-10'),
      filingDate: new Date('2026-02-01')
    });

    const case3 = await Case.create({
      caseNumber: 'FHC/ABJ/CS/2025/119',
      title: 'Apex Bank vs. Transcontinental Shipping',
      description: 'Breach of maritime credit facility contract.',
      stage: 'Judgment',
      status: 'Resolved',
      court: 'Abuja Federal High Court',
      plaintiffs: ['Apex Commercial Bank Plc'],
      defendants: ['Transcontinental Shipping Lines Ltd'],
      judge: judge._id,
      lawyers: [lawyer._id],
      isProBono: false,
      filingDate: new Date('2025-06-20')
    });

    console.log('Sample cases created.');

    console.log('Creating initial status audit logs...');
    await StatusHistory.create([
      {
        caseId: case1._id,
        changedBy: clerk._id,
        newStage: 'Pre-Trial',
        newStatus: 'Active',
        comments: 'Case filed and assigned to Court 1'
      },
      {
        caseId: case1._id,
        changedBy: judge._id,
        previousStage: 'Pre-Trial',
        newStage: 'Trial',
        previousStatus: 'Active',
        newStatus: 'Active',
        comments: 'Initial hearing completed. Proceeded to trial.'
      },
      {
        caseId: case2._id,
        changedBy: clerk._id,
        newStage: 'Pre-Trial',
        newStatus: 'Active',
        comments: 'Pro-bono petition logged for legal representation.'
      }
    ]);

    console.log('====================================================');
    console.log('SEEDING COMPLETED SUCCESSFULLY!');
    console.log('All accounts share password: Password123!');
    console.log('====================================================');

    process.exit(0);
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  }
};

seedData();
