const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const categories =[
  {
    "id": 1,
    "name": "Accessories"
  },
  {
    "id": 2,
    "name": "Add-on"
  },
  {
    "id": 3,
    "name": "Bag / Tote"
  },
  {
    "id": 4,
    "name": "Beanie / Hat"
  },
  {
    "id": 5,
    "name": "Bodysuit"
  },
  {
    "id": 6,
    "name": "Coat / Jacket"
  },
  {
    "id": 7,
    "name": "Costume"
  },
  {
    "id": 8,
    "name": "Dress"
  },
  {
    "id": 9,
    "name": "Intimate Apparel"
  },
  {
    "id": 10,
    "name": "Joggers / Sweatpants"
  },
  {
    "id": 11,
    "name": "Jumpsuit"
  },
  {
    "id": 12,
    "name": "Leggings"
  },
  {
    "id": 13,
    "name": "Maternity"
  },
  {
    "id": 14,
    "name": "Onesies / Rompers"
  },
  {
    "id": 15,
    "name": "Other"
  },
  {
    "id": 16,
    "name": "Overalls / Coveralls"
  },
  {
    "id": 17,
    "name": "Pants / Jeans"
  },
  {
    "id": 18,
    "name": "Poncho"
  },
  {
    "id": 19,
    "name": "Robe"
  },
  {
    "id": 20,
    "name": "Short"
  },
  {
    "id": 21,
    "name": "Shrug / Bolero"
  },
  {
    "id": 22,
    "name": "Skirt"
  },
  {
    "id": 23,
    "name": "Skort"
  },
  {
    "id": 24,
    "name": "Sleepwear / Pajama"
  },
  {
    "id": 25,
    "name": "Slippers / Booties"
  },
  {
    "id": 26,
    "name": "Sweater / Sweatshirt"
  },
  {
    "id": 27,
    "name": "Swimwear"
  },
  {
    "id": 28,
    "name": "Tops"
  },
  {
    "id": 29,
    "name": "Vest"
  }
];

async function main() {
  console.log(`Start seeding categories...`);

  for (const category of categories) {
    await prisma.category.create({
      data: category,
    });
  }

  console.log(`Seeding categories completed.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });