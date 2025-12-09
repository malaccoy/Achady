import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const groups = await prisma.group.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(groups);
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao buscar grupos' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { link, name } = body;

    if (!link) {
      return NextResponse.json({ error: 'Link é obrigatório' }, { status: 400 });
    }

    const group = await prisma.group.create({
      data: {
        link,
        name: name || 'Grupo Pendente',
        active: true,
      },
    });

    return NextResponse.json(group, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao criar grupo' }, { status: 500 });
  }
}