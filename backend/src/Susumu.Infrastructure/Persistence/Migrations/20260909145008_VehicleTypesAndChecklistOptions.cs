using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Susumu.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class VehicleTypesAndChecklistOptions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "AllowedStatuses",
                table: "checklist_items",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "vehicle_types",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    Code = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    NormalizedCode = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    Name = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    Active = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Version = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_vehicle_types", x => x.Id);
                    table.ForeignKey(
                        name: "FK_vehicle_types_companies_CompanyId",
                        column: x => x.CompanyId,
                        principalTable: "companies",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_vehicle_types_CompanyId_NormalizedCode",
                table: "vehicle_types",
                columns: new[] { "CompanyId", "NormalizedCode" },
                unique: true);

            // Historical strings stay untouched. Only the new catalog is populated, collapsing
            // case aliases within each company while preserving the same code in other companies.
            // pg_c_utf8 supplies Unicode simple case mapping on every PostgreSQL 18 platform;
            // the database's default C locale only uppercases ASCII and corrupts accented lookups.
            migrationBuilder.Sql("""
                INSERT INTO vehicle_types
                    ("Id", "CompanyId", "Code", "NormalizedCode", "Name", "Active", "CreatedAt", "UpdatedAt", "Version")
                SELECT gen_random_uuid(), "CompanyId", min(code COLLATE "C"), normalized,
                       min(code COLLATE "C"), TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 1
                FROM (
                    SELECT "CompanyId", btrim("Type") AS code,
                           upper(btrim("Type") COLLATE "pg_c_utf8") AS normalized FROM vehicles
                    UNION ALL
                    SELECT "CompanyId", btrim("VehicleType"),
                           upper(btrim("VehicleType") COLLATE "pg_c_utf8") FROM checklist_templates
                ) existing_codes
                GROUP BY "CompanyId", normalized;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "vehicle_types");

            migrationBuilder.DropColumn(
                name: "AllowedStatuses",
                table: "checklist_items");
        }
    }
}
