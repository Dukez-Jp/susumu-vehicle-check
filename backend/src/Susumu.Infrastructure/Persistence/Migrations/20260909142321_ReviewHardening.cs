using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Susumu.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class ReviewHardening : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "AdministrationStamp",
                table: "companies",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddUniqueConstraint(
                name: "AK_users_CompanyId_Id",
                table: "users",
                columns: new[] { "CompanyId", "Id" });

            migrationBuilder.AddUniqueConstraint(
                name: "AK_locations_CompanyId_Id",
                table: "locations",
                columns: new[] { "CompanyId", "Id" });

            migrationBuilder.CreateTable(
                name: "employees",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    LocationId = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: true),
                    EmployeeNumber = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Active = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Version = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_employees", x => x.Id);
                    table.ForeignKey(
                        name: "FK_employees_companies_CompanyId",
                        column: x => x.CompanyId,
                        principalTable: "companies",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_employees_locations_CompanyId_LocationId",
                        columns: x => new { x.CompanyId, x.LocationId },
                        principalTable: "locations",
                        principalColumns: new[] { "CompanyId", "Id" },
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_employees_users_CompanyId_UserId",
                        columns: x => new { x.CompanyId, x.UserId },
                        principalTable: "users",
                        principalColumns: new[] { "CompanyId", "Id" },
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_employees_CompanyId_EmployeeNumber",
                table: "employees",
                columns: new[] { "CompanyId", "EmployeeNumber" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_employees_CompanyId_LocationId",
                table: "employees",
                columns: new[] { "CompanyId", "LocationId" });

            migrationBuilder.CreateIndex(
                name: "IX_employees_CompanyId_UserId",
                table: "employees",
                columns: new[] { "CompanyId", "UserId" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "employees");

            migrationBuilder.DropUniqueConstraint(
                name: "AK_users_CompanyId_Id",
                table: "users");

            migrationBuilder.DropUniqueConstraint(
                name: "AK_locations_CompanyId_Id",
                table: "locations");

            migrationBuilder.DropColumn(
                name: "AdministrationStamp",
                table: "companies");
        }
    }
}
