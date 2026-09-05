-- AlterTable
ALTER TABLE "CardModifier" ADD COLUMN     "categories" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "conditionType" TEXT,
ADD COLUMN     "conditionValue" TEXT;
