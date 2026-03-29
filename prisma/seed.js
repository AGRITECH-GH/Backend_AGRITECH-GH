import { PrismaClient } from '../prisma/prisma-client-js/index.js'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
    console.log('Seeding database...')

    const hashedPassword = await bcrypt.hash('Admin1234', 12)

    const admin = await prisma.user.upsert({
        where: { email: 'admin@agritechgh.me' },
        update: {},
        create: {
            fullName: 'AgriTech Admin',
            email: 'admin@agritechgh.me',
            passwordHash: hashedPassword,
            role: 'ADMIN',
            isVerified: true,
            isActive: true
        }
    })

    async function main() {
        console.log('Seeding database...')

        const hashedPassword = await bcrypt.hash('Admin1234', 12)

        const admin = await prisma.user.upsert({
            where: { email: 'stankofb@gmail.com' },
            update: {},
            create: {
                fullName: 'AgriTech Admin',
                email: 'stankofb@gmail.com',
                passwordHash: hashedPassword,
                role: 'ADMIN',
                isVerified: true,
                isActive: true
            }
        })

        console.log('✅ Admin created:', admin.email)
        console.log('✅ Admin created:', admin.email)

        console.log('Done!')
    }

    main()
        .catch((e) => {
            console.error(e)
            process.exit(1)
        })
        .finally(async () => {
            await prisma.$disconnect()
        })

    console.log('✅ Admin created:', admin.email)
    console.log('Done!')
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })