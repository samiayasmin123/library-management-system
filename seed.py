import argparse

from app.database.seeder import book_seeder


def main():
    parser = argparse.ArgumentParser(description="A Simple seed command cli")

    parser.add_argument("-t", "--table", type=str, help="table name")
    args = parser.parse_args()

    if args.table == 'book':
        print("seeding...", args.table)
        book_seeder()
    else:
        print("No table found for: ", args.table)

if __name__ == "__main__":
    main()
