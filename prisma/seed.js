const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // Create roles
  console.log('📝 Creating roles...');
  const roles = await Promise.all([
    prisma.role.create({
      data: { name: 'admin' }
    }),
    prisma.role.create({
      data: { name: 'manager' }
    }),
    prisma.role.create({
      data: { name: 'operator' }
    }),
    prisma.role.create({
      data: { name: 'salesperson' }
    }),
    prisma.role.create({
      data: { name: 'accountant' }
    })
  ]);

  console.log('✅ Roles created:', roles.map(r => r.name));

  // Hash password for all users
  const hashedPassword = await bcrypt.hash('asdf', 12);

  // Create users with individual roles
  console.log('👥 Creating users...');
  
  const users = await Promise.all([
    // Admin user
    prisma.user.create({
      data: {
        email: 'admin@example.com',
        username: 'admin',
        hashedPassword,
        name: 'Admin',
        lastName: 'User',
        userRoles: {
          create: {
            roleId: roles[0].id // admin role
          }
        }
      }
    }),
    
    // Manager user
    prisma.user.create({
      data: {
        email: 'manager@example.com',
        username: 'manager',
        hashedPassword,
        name: 'Manager',
        lastName: 'User',
        userRoles: {
          create: {
            roleId: roles[1].id // manager role
          }
        }
      }
    }),
    
    // Operator user
    prisma.user.create({
      data: {
        email: 'operator@example.com',
        username: 'operator',
        hashedPassword,
        name: 'Operator',
        lastName: 'User',
        userRoles: {
          create: {
            roleId: roles[2].id // operator role
          }
        }
      }
    }),
    
    // Salesperson user
    prisma.user.create({
      data: {
        email: 'salesperson@example.com',
        username: 'salesperson',
        hashedPassword,
        name: 'Sales',
        lastName: 'Person',
        userRoles: {
          create: {
            roleId: roles[3].id // salesperson role
          }
        }
      }
    }),
    
    // Accountant user
    prisma.user.create({
      data: {
        email: 'accountant@example.com',
        username: 'accountant',
        hashedPassword,
        name: 'Accountant',
        lastName: 'User',
        userRoles: {
          create: {
            roleId: roles[4].id // accountant role
          }
        }
      }
    }),
    
    // Super admin with all roles
    prisma.user.create({
      data: {
        email: 'superadmin@example.com',
        username: 'superadmin',
        hashedPassword,
        name: 'Super',
        lastName: 'Admin',
        userRoles: {
          create: roles.map(role => ({
            roleId: role.id
          }))
        }
      }
    })
  ]);

  console.log('✅ Users created:');
  users.forEach(user => {
    console.log(`  - ${user.username} (${user.email})`);
  });

  // Create configuration (if it doesn't exist)
  console.log('⚙️ Creating configuration...');
  const existingConfig = await prisma.configuration.findFirst();
  if (!existingConfig) {
    await prisma.configuration.create({
      data: {
        twoFactorEnabled: false,
        appName: 'Application'
      }
    });
    console.log('✅ Configuration created with 2FA disabled');
  } else {
    console.log('✅ Configuration already exists');
  }

  console.log('🎉 Database seeding completed successfully!');
  console.log('\n📋 Summary:');
  console.log('  - 5 roles created');
  console.log('  - 6 users created');
  console.log('  - Configuration initialized');
  console.log('  - All users have password: "asdf"');
  console.log('  - Super admin has all roles');
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });