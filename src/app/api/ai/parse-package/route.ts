import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import { prisma } from '@/lib/prisma';

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY!
});

export async function POST(request: NextRequest) {
    try {
        const { message, agentRole } = await request.json();

        const completion = await groq.chat.completions.create({
            messages: [
                {
                    role: "system",
                    content: `Tu es un assistant pour NIMAPLEX, système de tracking de colis Niger-Canada-Guinée.
L'agent te donne des informations sur un colis en langage naturel.
Extrais les informations structurées.

Rôle de l'agent: ${agentRole}
- Si AGENT_NE : colis vient du Niger
- Si AGENT_CA : colis vient du Canada  
- Si AGENT_GN : colis vient de Guinée

Réponds UNIQUEMENT avec un JSON valide (sans markdown, sans \`\`\`json) avec cette structure:
{
  "action": "create_package" ou "search_client" ou "question",
  "clientName": "nom complet du client si mentionné",
  "clientEmail": "email du client si mentionné",
  "clientPhone": "téléphone du client si mentionné",
  "weight": nombre en kg si mentionné,
  "content": "description du contenu si mentionné",
  "destination": "NIGER" ou "CANADA" ou "GUINEA" si mentionné,
  "amount": montant si mentionné (nombre),
  "searchTerm": "terme de recherche si l'agent cherche un client",
  "question": "ta réponse si c'est une question générale"
}

Exemples:
- "Colis pour Amadou Diallo, 5kg, vêtements" → {"action":"create_package","clientName":"Amadou Diallo","weight":5,"content":"vêtements"}
- "Colis pour Fatima, email fatima@gmail.com, tel 90123456, 3kg" → {"action":"create_package","clientName":"Fatima","clientEmail":"fatima@gmail.com","clientPhone":"90123456","weight":3}`
                },
                {
                    role: "user",
                    content: message
                }
            ],
            model: "llama-3.3-70b-versatile", // Très bon et gratuit
            temperature: 0.2,
            max_tokens: 500,
        });

        const text = completion.choices[0]?.message?.content || '';

        let parsedData;
        try {
            const cleanText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
            parsedData = JSON.parse(cleanText);
        } catch (e) {
            console.error('Erreur parsing JSON:', text);
            return NextResponse.json({
                type: 'error',
                message: 'Désolé, je n\'ai pas bien compris. Peux-tu reformuler ?'
            });
        }

        // RECHERCHE DE CLIENT
        if (parsedData.action === "search_client" && parsedData.searchTerm) {
            const clients = await prisma.shipment.findMany({
                where: {
                    OR: [
                        { receiverName: { contains: parsedData.searchTerm, mode: 'insensitive' } },
                        { receiverCity: { contains: parsedData.searchTerm, mode: 'insensitive' } },
                        { receiverEmail: { contains: parsedData.searchTerm } },
                        { receiverPhone: { contains: parsedData.searchTerm, mode: 'insensitive' } }
                    ]
                },
                take: 5,
                select: {
                    id: true,
                    receiverName: true,
                    receiverCity: true,
                    receiverEmail: true,
                    receiverPhone: true
                }
            });

            return NextResponse.json({
                type: 'client_search',
                clients: clients,
                searchTerm: parsedData.searchTerm
            });
        }

        // CRÉATION DE COLIS
        if (parsedData.action === "create_package") {
            if (!parsedData.clientName) {
                return NextResponse.json({
                    type: 'message',
                    content: 'Il me faut au minimum le nom du client pour créer un colis.'
                });
            }

            return NextResponse.json({
                type: 'package_data',
                data: {
                    clientName: parsedData.clientName,
                    clientEmail: parsedData.clientEmail || null,
                    clientPhone: parsedData.clientPhone || null,
                    weight: parsedData.weight || null,
                    content: parsedData.content || '',
                    destination: parsedData.destination || null,
                    amount: parsedData.amount || null
                },
                needsConfirmation: true
            });
        }

        // QUESTION GÉNÉRALE
        if (parsedData.action === "question") {
            return NextResponse.json({
                type: 'message',
                content: parsedData.question || 'Comment puis-je t\'aider ?'
            });
        }

        return NextResponse.json({
            type: 'message',
            content: 'Je n\'ai pas bien compris. Essaie de me donner les infos du colis : nom client, poids, contenu, destination.'
        });

    } catch (error) {
        console.error('Erreur API Groq:', error);
        return NextResponse.json(
            { error: 'Erreur lors du traitement' },
            { status: 500 }
        );
    }
}