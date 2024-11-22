-- CreateTable
CREATE TABLE "Attribute" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,

    CONSTRAINT "Attribute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Designer" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "url" TEXT NOT NULL,
    "logo_url" TEXT,
    "email" VARCHAR(255),
    "address" VARCHAR(255),
    "facebook" TEXT,
    "instagram" TEXT,
    "pinterest" TEXT,
    "youtube" TEXT,

    CONSTRAINT "Designer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Format" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,

    CONSTRAINT "Format_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pattern" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "designer_id" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "thumbnail_url" TEXT,
    "yardage" VARCHAR(255),
    "sizes" VARCHAR(255),
    "language" VARCHAR(255),

    CONSTRAINT "Pattern_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SuggestedFabric" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,

    CONSTRAINT "SuggestedFabric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatternAttribute" (
    "id" SERIAL NOT NULL,
    "pattern_id" INTEGER NOT NULL,
    "attribute_id" INTEGER NOT NULL,

    CONSTRAINT "PatternAttribute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatternCategory" (
    "id" SERIAL NOT NULL,
    "pattern_id" INTEGER NOT NULL,
    "category_id" INTEGER NOT NULL,

    CONSTRAINT "PatternCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatternFormat" (
    "id" SERIAL NOT NULL,
    "pattern_id" INTEGER NOT NULL,
    "format_id" INTEGER NOT NULL,

    CONSTRAINT "PatternFormat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatternSuggestedFabric" (
    "id" SERIAL NOT NULL,
    "pattern_id" INTEGER NOT NULL,
    "suggested_fabric_id" INTEGER NOT NULL,

    CONSTRAINT "PatternSuggestedFabric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Audience" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,

    CONSTRAINT "Audience_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatternAudience" (
    "id" SERIAL NOT NULL,
    "pattern_id" INTEGER NOT NULL,
    "audience_id" INTEGER NOT NULL,

    CONSTRAINT "PatternAudience_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FabricType" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,

    CONSTRAINT "FabricType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatternFabricType" (
    "id" SERIAL NOT NULL,
    "pattern_id" INTEGER NOT NULL,
    "fabric_type_id" INTEGER NOT NULL,

    CONSTRAINT "PatternFabricType_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PatternAttribute_pattern_id_attribute_id_key" ON "PatternAttribute"("pattern_id", "attribute_id");

-- CreateIndex
CREATE UNIQUE INDEX "PatternCategory_pattern_id_category_id_key" ON "PatternCategory"("pattern_id", "category_id");

-- CreateIndex
CREATE UNIQUE INDEX "PatternFormat_pattern_id_format_id_key" ON "PatternFormat"("pattern_id", "format_id");

-- CreateIndex
CREATE UNIQUE INDEX "PatternSuggestedFabric_pattern_id_suggested_fabric_id_key" ON "PatternSuggestedFabric"("pattern_id", "suggested_fabric_id");

-- CreateIndex
CREATE UNIQUE INDEX "PatternAudience_pattern_id_audience_id_key" ON "PatternAudience"("pattern_id", "audience_id");

-- CreateIndex
CREATE UNIQUE INDEX "PatternFabricType_pattern_id_fabric_type_id_key" ON "PatternFabricType"("pattern_id", "fabric_type_id");

-- AddForeignKey
ALTER TABLE "Pattern" ADD CONSTRAINT "Pattern_designer_id_fkey" FOREIGN KEY ("designer_id") REFERENCES "Designer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatternAttribute" ADD CONSTRAINT "PatternAttribute_pattern_id_fkey" FOREIGN KEY ("pattern_id") REFERENCES "Pattern"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatternAttribute" ADD CONSTRAINT "PatternAttribute_attribute_id_fkey" FOREIGN KEY ("attribute_id") REFERENCES "Attribute"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatternCategory" ADD CONSTRAINT "PatternCategory_pattern_id_fkey" FOREIGN KEY ("pattern_id") REFERENCES "Pattern"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatternCategory" ADD CONSTRAINT "PatternCategory_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatternFormat" ADD CONSTRAINT "PatternFormat_pattern_id_fkey" FOREIGN KEY ("pattern_id") REFERENCES "Pattern"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatternFormat" ADD CONSTRAINT "PatternFormat_format_id_fkey" FOREIGN KEY ("format_id") REFERENCES "Format"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatternSuggestedFabric" ADD CONSTRAINT "PatternSuggestedFabric_pattern_id_fkey" FOREIGN KEY ("pattern_id") REFERENCES "Pattern"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatternSuggestedFabric" ADD CONSTRAINT "PatternSuggestedFabric_suggested_fabric_id_fkey" FOREIGN KEY ("suggested_fabric_id") REFERENCES "SuggestedFabric"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatternAudience" ADD CONSTRAINT "PatternAudience_pattern_id_fkey" FOREIGN KEY ("pattern_id") REFERENCES "Pattern"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatternAudience" ADD CONSTRAINT "PatternAudience_audience_id_fkey" FOREIGN KEY ("audience_id") REFERENCES "Audience"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatternFabricType" ADD CONSTRAINT "PatternFabricType_pattern_id_fkey" FOREIGN KEY ("pattern_id") REFERENCES "Pattern"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatternFabricType" ADD CONSTRAINT "PatternFabricType_fabric_type_id_fkey" FOREIGN KEY ("fabric_type_id") REFERENCES "FabricType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
