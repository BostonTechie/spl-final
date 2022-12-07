-- CreateTable
CREATE TABLE "History_price_Voucher" (
    "id" SERIAL NOT NULL,
    "Asset" TEXT,
    "Date" TIMESTAMP(3),
    "price_hive" DECIMAL(65,6) DEFAULT 0,
    "price_usd" DECIMAL(65,6) DEFAULT 0,

    CONSTRAINT "History_price_Voucher_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "History_price_Voucher_id_key" ON "History_price_Voucher"("id");
